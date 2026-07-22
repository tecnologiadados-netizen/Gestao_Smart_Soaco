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
import {
  executarAlertasClienteRegularizado,
  previewAlertaClienteRegularizado,
} from './crmCreditoRegularizacaoService.js';
import {
  executarResumoDiarioCredito,
  previewResumoDiarioCredito,
} from './crmCreditoResumoDiarioEmailService.js';
import {
  executarAlertasSlaSemAcao,
  previewAlertaSlaSemAcao,
} from './crmCreditoSlaSemAcaoService.js';
import { envioNotificacoesHabilitado } from '../config/envioNotificacoes.js';
import {
  comExecucaoRegistrada,
  type OrigemNotificacao,
  type TentativaInput,
} from './notificacaoExecucaoService.js';

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
  financeiro_credito_cliente_regularizado: (ctx) =>
    executarAlertasClienteRegularizado(ctx.prisma, ctx.destinatarios, {
      ignorarDedup: ctx.ignorarDedup,
    }),
  financeiro_credito_resumo_diario: (ctx) =>
    executarResumoDiarioCredito(ctx.prisma, ctx.destinatarios, {
      ignorarDedup: ctx.ignorarDedup,
    }),
  financeiro_credito_sla_sem_acao: (ctx) =>
    executarAlertasSlaSemAcao(ctx.prisma, ctx.destinatarios, {
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

function tentativasFromBuilderResult(
  destinatarios: string[],
  result: BuilderResult,
  dryRun: boolean
): {
  tentativas: TentativaInput[];
  forcarSkipped?: boolean;
  status?: 'success' | 'skipped' | 'failed' | 'partial';
  resumo: string;
  erroMensagem?: string;
} {
  const { enviados, ignorados, erros } = result;

  if (enviados === 0 && erros.length === 0) {
    return {
      tentativas: [],
      forcarSkipped: true,
      status: 'skipped',
      resumo:
        ignorados > 0
          ? `Sem disparo (${ignorados} ignorado(s) por dedup/sem conteúdo)`
          : 'Sem disparo (nenhum alerta pendente)',
    };
  }

  const tentativas: TentativaInput[] = [];

  if (enviados > 0) {
    for (const email of destinatarios) {
      tentativas.push({
        canal: 'email',
        destinatario: email,
        ok: true,
        dryRun,
      });
    }
  }

  for (const erro of erros) {
    tentativas.push({
      canal: 'email',
      destinatario: erro.split(':')[0]?.trim() || '—',
      ok: false,
      erro,
    });
  }

  let status: 'success' | 'failed' | 'partial' = 'success';
  if (enviados === 0 && erros.length > 0) status = 'failed';
  else if (enviados > 0 && erros.length > 0) status = 'partial';

  const parts: string[] = [];
  if (enviados > 0) parts.push(`${enviados} e-mail(s)${dryRun ? ' dry-run' : ''}`);
  if (ignorados > 0) parts.push(`${ignorados} ignorado(s)`);
  if (erros.length > 0) parts.push(`${erros.length} erro(s)`);

  return {
    tentativas,
    status,
    resumo: parts.join(', ') || 'Sem disparo',
    erroMensagem: erros.length > 0 ? erros.slice(0, 3).join('; ') : undefined,
  };
}

export async function executarNotificacaoEmailAgendada(
  code: string,
  origem: OrigemNotificacao = 'cron'
): Promise<void> {
  const tipo = await buscarTipoEmailPorCode(code);
  if (!tipo || !tipo.ativo) return;

  await comExecucaoRegistrada(
    { canal: 'email', tipoCode: tipo.code, tipoId: tipo.id, origem },
    async () => {
      const settings = await fetchEmailProviderSettings(prisma);
      if (!settings) {
        console.log(`[emailNotificacaoCron] "${code}": credencial de e-mail não configurada.`);
        return {
          result: undefined as void,
          forcarSkipped: true,
          status: 'skipped' as const,
          resumo: 'Credencial de e-mail não configurada',
          erroMensagem: 'Credencial de e-mail não configurada',
          tentativas: [],
        };
      }

      const destinatarios = listarEmailsDestinatarios(tipo);
      if (destinatarios.length === 0) {
        console.warn(`[emailNotificacaoCron] "${code}": nenhum destinatário com e-mail válido.`);
        return {
          result: undefined as void,
          forcarSkipped: true,
          status: 'skipped' as const,
          resumo: 'Nenhum destinatário com e-mail válido',
          tentativas: [],
        };
      }

      const builderCode = tipo.builderCode?.trim();
      const builder = builderCode ? BUILDERS[builderCode] : undefined;
      if (!builder) {
        console.error(`[emailNotificacaoCron] "${code}": builder "${builderCode ?? ''}" não registrado.`);
        return {
          result: undefined as void,
          status: 'failed' as const,
          erroMensagem: `Builder "${builderCode ?? ''}" não registrado`,
          resumo: 'Falha na execução',
          tentativas: [],
        };
      }

      try {
        const dryRun = !envioNotificacoesHabilitado();
        const result = await builder({ prisma, destinatarios });
        console.log(
          `[emailNotificacaoCron] "${code}": ${result.enviados} e-mail(s), ${result.ignorados} ignorado(s) (dedup).`
        );
        if (result.erros.length > 0) {
          console.error(`[emailNotificacaoCron] "${code}" erros:`, result.erros.join('; '));
        }

        const mapped = tentativasFromBuilderResult(destinatarios, result, dryRun);
        return {
          result: undefined as void,
          ...mapped,
          metadados: {
            enviados: result.enviados,
            ignorados: result.ignorados,
            erros: result.erros.length,
            dryRun,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[emailNotificacaoCron] "${code}":`, msg);
        return {
          result: undefined as void,
          status: 'failed' as const,
          erroMensagem: msg,
          resumo: 'Falha na execução',
          tentativas: [],
        };
      }
    }
  );
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

  if (builderCode === 'financeiro_credito_cliente_regularizado') {
    const { quantidade, previews } = await previewAlertaClienteRegularizado(prisma);
    if (previews.length === 0) {
      return {
        subject: '[Preview] Nenhum cliente regularizado pendente',
        html: '<p>Não há clientes regularizados aguardando alerta para a analista de crédito.</p>',
        resumo: 'Nenhum alerta de regularização pendente.',
        quantidadeAlertas: 0,
      };
    }
    const first = previews[0]!;
    const resumo =
      quantidade === 1
        ? `1 cliente regularizado: ${first.clienteNome}.`
        : `${quantidade} clientes regularizados. Preview do primeiro: ${first.clienteNome}.`;
    return {
      subject: first.subject,
      html: first.html,
      resumo,
      quantidadeAlertas: quantidade,
    };
  }

  if (builderCode === 'financeiro_credito_resumo_diario') {
    const preview = await previewResumoDiarioCredito(prisma);
    return {
      subject: preview.subject,
      html: preview.html,
      resumo: preview.resumo,
      quantidadeAlertas: preview.quantidade,
    };
  }

  if (builderCode === 'financeiro_credito_sla_sem_acao') {
    const preview = await previewAlertaSlaSemAcao(prisma);
    return {
      subject: preview.subject,
      html: preview.html,
      resumo: preview.resumo,
      quantidadeAlertas: preview.quantidade,
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

  await comExecucaoRegistrada(
    { canal: 'email', tipoCode: tipo.code, tipoId: tipo.id, origem: 'teste' },
    async () => {
      const dryRun = !envioNotificacoesHabilitado();
      const result = await builder({
        prisma,
        destinatarios: [email],
        ignorarDedup: true,
      });

      if (result.enviados === 0) {
        const msg =
          result.erros[0] ??
          (result.ignorados > 0
            ? 'Nenhum alerta para enviar no momento (sem conteúdo ou já enviado hoje).'
            : 'Nenhum e-mail enviado.');
        throw new Error(msg);
      }

      return {
        result: undefined as void,
        tentativas: [
          {
            canal: 'email' as const,
            destinatario: email,
            usuarioId,
            ok: true,
            dryRun,
          },
        ],
        metadados: {
          teste: true,
          dryRun,
          enviados: result.enviados,
          ignorados: result.ignorados,
        },
      };
    }
  );
}

export type { EmailNotificacaoTipoRow };
