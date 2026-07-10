/**
 * Montagem e envio de notificações por e-mail configuráveis (Integração → E-mail).
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  buscarTipoEmailPorCode,
  buscarTipoEmailPorId,
  type EmailNotificacaoTipoRow,
} from '../data/emailNotificacaoRepository.js';
import { fetchEmailProviderSettings } from './systemEmail.js';
import {
  executarAlertasCreditoPedidoAtraso,
  previewAlertaCreditoPedidoAtraso,
} from './financeiroCreditoPedidoAtrasoEmailService.js';

type TipoComDestinatarios = NonNullable<Awaited<ReturnType<typeof buscarTipoEmailPorCode>>>;

type BuilderContext = {
  prisma: PrismaClient;
  destinatarios: string[];
  ignorarDedup?: boolean;
};

type BuilderResult = { enviados: number; ignorados: number; erros: string[] };

const BUILDERS: Record<string, (ctx: BuilderContext) => Promise<BuilderResult>> = {
  financeiro_credito_pedido_atraso: (ctx) =>
    executarAlertasCreditoPedidoAtraso(ctx.prisma, ctx.destinatarios, {
      ignorarDedup: ctx.ignorarDedup,
    }),
};

export function listarEmailsDestinatarios(tipo: TipoComDestinatarios): string[] {
  const emails = new Set<string>();
  for (const d of tipo.destinatarios) {
    if (!d.usuario.ativo) continue;
    const email = (d.usuario.email ?? '').trim().toLowerCase();
    if (email.includes('@')) emails.add(email);
  }
  return [...emails];
}

export async function executarNotificacaoEmailAgendada(code: string): Promise<void> {
  const tipo = await buscarTipoEmailPorCode(code);
  if (!tipo || !tipo.ativo) return;

  const settings = await fetchEmailProviderSettings(prisma);
  if (!settings) {
    console.log(`[emailNotificacaoCron] "${code}": credencial de e-mail não configurada.`);
    return;
  }

  const destinatarios = listarEmailsDestinatarios(tipo);
  if (destinatarios.length === 0) {
    console.warn(`[emailNotificacaoCron] "${code}": nenhum destinatário com e-mail válido.`);
    return;
  }

  const builderCode = tipo.builderCode?.trim();
  const builder = builderCode ? BUILDERS[builderCode] : undefined;
  if (!builder) {
    console.error(`[emailNotificacaoCron] "${code}": builder "${builderCode ?? ''}" não registrado.`);
    return;
  }

  try {
    const result = await builder({ prisma, destinatarios });
    console.log(
      `[emailNotificacaoCron] "${code}": ${result.enviados} e-mail(s), ${result.ignorados} ignorado(s) (dedup).`
    );
    if (result.erros.length > 0) {
      console.error(`[emailNotificacaoCron] "${code}" erros:`, result.erros.join('; '));
    }
  } catch (err) {
    console.error(`[emailNotificacaoCron] "${code}":`, err instanceof Error ? err.message : err);
  }
}

export async function previewEmailDoTipo(tipoId: number): Promise<{
  subject: string;
  html: string;
  resumo: string;
  quantidadeAlertas: number;
}> {
  const tipo = await buscarTipoEmailPorId(tipoId);
  if (!tipo) throw new Error('Tipo não encontrado.');

  const builderCode = tipo.builderCode?.trim();
  if (builderCode === 'financeiro_credito_pedido_atraso') {
    const { alertas, previews } = await previewAlertaCreditoPedidoAtraso();
    if (previews.length === 0) {
      return {
        subject: '[Preview] Nenhum alerta no momento',
        html: '<p>Não há clientes com pedido em aberto e contas a receber em atraso.</p>',
        resumo: 'Nenhum alerta pendente.',
        quantidadeAlertas: 0,
      };
    }
    const first = previews[0]!;
    const resumo =
      alertas.length === 1
        ? `1 cliente com condição de alerta: ${first.clienteNome}.`
        : `${alertas.length} clientes com condição de alerta. Preview do primeiro: ${first.clienteNome}.`;
    return {
      subject: first.subject,
      html: first.html,
      resumo,
      quantidadeAlertas: alertas.length,
    };
  }

  throw new Error(`Preview não disponível para builder "${builderCode ?? ''}".`);
}

export async function testarEnvioEmailTipo(tipoId: number, usuarioId: number): Promise<void> {
  const tipo = await buscarTipoEmailPorId(tipoId);
  if (!tipo) throw new Error('Tipo não encontrado.');

  const dest = tipo.destinatarios.find((d) => d.usuarioId === usuarioId);
  if (!dest) throw new Error('Usuário não é destinatário deste tipo.');

  const email = (dest.usuario.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Usuário sem e-mail válido cadastrado.');

  const settings = await fetchEmailProviderSettings(prisma);
  if (!settings) throw new Error('Credencial de e-mail não configurada.');

  const builderCode = tipo.builderCode?.trim();
  const builder = builderCode ? BUILDERS[builderCode] : undefined;
  if (!builder) throw new Error(`Builder "${builderCode ?? ''}" não registrado.`);

  const result = await builder({
    prisma,
    destinatarios: [email],
    ignorarDedup: true,
  });

  if (result.enviados === 0) {
    const msg =
      result.erros[0] ??
      (result.ignorados > 0
        ? 'Nenhum alerta para enviar no momento (sem clientes em risco).'
        : 'Nenhum e-mail enviado.');
    throw new Error(msg);
  }
}

export type { EmailNotificacaoTipoRow };
