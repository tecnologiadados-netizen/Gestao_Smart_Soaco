/**
 * Alerta por e-mail ao gravar comentário no Orgânico com tom sensível
 * ou visibilidade confidencial (Integração → E-mail, disparo por evento).
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { envioNotificacoesHabilitado } from '../config/envioNotificacoes.js';
import { buscarTipoEmailPorCode } from '../data/emailNotificacaoRepository.js';
import { getConfig } from '../rh/repositories/configRepository.js';
import {
  getRhCommentTagLabel,
  getRhCommentTagTone,
  getRhCommentToneLabel,
  getRhCommentVisibilityLabel,
  parseRhCommentTagCatalog,
  RH_ORGANICO_COMMENT_TAGS_CONFIG_KEY,
  type RhOrganicoCommentTagOption,
} from '../rh/lib/rh-organico-comment-tags.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import {
  comExecucaoRegistrada,
  type OrigemNotificacao,
} from './notificacaoExecucaoService.js';
import { sendSystemEmail } from './systemEmail.js';

type TipoComDestinatarios = NonNullable<Awaited<ReturnType<typeof buscarTipoEmailPorCode>>>;

function emailsDoTipo(tipo: TipoComDestinatarios): string[] {
  const emails = new Set<string>();
  for (const d of tipo.destinatarios) {
    if (!d.usuario.ativo) continue;
    const email = (d.usuario.email ?? '').trim().toLowerCase();
    if (email.includes('@')) emails.add(email);
  }
  return [...emails];
}

export const ORGANICO_COMENTARIO_ALERTA_EMAIL_CODE = 'rh_organico_comentario_sensivel';

export type OrganicoComentarioAlertaInput = {
  colaboradorNome: string;
  colaboradorMatricula: string | null;
  comentario: string;
  tipo: string;
  tagCode: string;
  visibility: string;
  createdBy: string;
  createdAt: string;
};

export type OrganicoComentarioAlertaEmail = {
  subject: string;
  html: string;
  tom: string;
  visibilidade: string;
  categoria: string;
  motivos: string[];
};

const AMOSTRA: OrganicoComentarioAlertaInput = {
  colaboradorNome: 'Colaborador de exemplo',
  colaboradorMatricula: '0001',
  comentario: 'Comentário de exemplo classificado como sensível ou confidencial.',
  tipo: 'comentario',
  tagCode: '20',
  visibility: 'confidential',
  createdBy: 'usuario.exemplo',
  createdAt: new Date().toISOString(),
};

export function comentarioOrganicoDisparaAlerta(
  input: Pick<OrganicoComentarioAlertaInput, 'tipo' | 'visibility' | 'tagCode'>,
  catalog: RhOrganicoCommentTagOption[]
): { dispara: boolean; motivos: string[] } {
  if (input.tipo !== 'comentario') return { dispara: false, motivos: [] };

  const motivos: string[] = [];
  const tom = getRhCommentTagTone(input.tagCode, catalog);
  if (tom === 'sensitive') motivos.push('tom_sensivel');
  if (input.visibility === 'confidential') motivos.push('visibilidade_confidencial');

  return { dispara: motivos.length > 0, motivos };
}

function formatarDataHoraBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function deepLinkOrganico(matricula: string | null): string {
  const base = resolveAppBaseUrl();
  const mat = (matricula ?? '').trim();
  if (!mat) return `${base}/rh/organico`;
  return `${base}/rh/organico?focusMatricula=${encodeURIComponent(mat)}`;
}

function labelMotivos(motivos: string[]): string {
  const parts: string[] = [];
  if (motivos.includes('tom_sensivel')) parts.push('tom Sensível');
  if (motivos.includes('visibilidade_confidencial')) parts.push('visibilidade Confidencial');
  return parts.join(' e ');
}

export function montarEmailComentarioOrganico(
  input: OrganicoComentarioAlertaInput,
  catalog: RhOrganicoCommentTagOption[],
  motivos: string[]
): OrganicoComentarioAlertaEmail {
  const tom = getRhCommentTagTone(input.tagCode, catalog);
  const tomLabel = getRhCommentToneLabel(tom);
  const categoria = getRhCommentTagLabel(input.tagCode, catalog);
  const visibilidade = getRhCommentVisibilityLabel(input.visibility);
  const matricula = (input.colaboradorMatricula ?? '').trim() || '—';
  const motivoTxt = labelMotivos(motivos);
  const subject = `[Gestão Smart] Comentário ${motivoTxt || 'sensível'} — ${input.colaboradorNome}`;

  const html = buildSystemEmailHtml({
    badge: 'RH · Orgânico',
    title: 'Comentário sensível ou confidencial',
    subtitle: input.colaboradorNome,
    intro: `Um comentário foi registrado no card do colaborador com ${motivoTxt || 'classificação restrita'}. Avalie o registro no Orgânico.`,
    sections: [
      {
        heading: 'Colaborador',
        rows: [
          { label: 'Nome', value: input.colaboradorNome },
          { label: 'Matrícula', value: matricula },
        ],
      },
      {
        heading: 'Classificação',
        rows: [
          { label: 'Tom', value: tomLabel },
          { label: 'Categoria', value: categoria },
          { label: 'Visibilidade', value: visibilidade },
          { label: 'Registrado por', value: input.createdBy },
          { label: 'Data e hora', value: formatarDataHoraBr(input.createdAt) },
        ],
      },
      {
        heading: 'Mensagem',
        rows: [{ label: 'Comentário', value: input.comentario }],
      },
    ],
    cta: {
      label: 'Abrir colaborador no Orgânico',
      href: deepLinkOrganico(input.colaboradorMatricula),
    },
    footerNote:
      'Este alerta é disparado automaticamente ao gravar um comentário no Orgânico com tom Sensível ou visibilidade Confidencial. Por favor, não responda este e-mail.',
  });

  return { subject, html, tom: tomLabel, visibilidade, categoria, motivos };
}

export async function carregarCatalogoTagsComentarioOrganico(): Promise<RhOrganicoCommentTagOption[]> {
  const raw = await getConfig(RH_ORGANICO_COMMENT_TAGS_CONFIG_KEY);
  return parseRhCommentTagCatalog(raw);
}

export async function previewAlertaComentarioOrganico(): Promise<{
  subject: string;
  html: string;
  resumo: string;
  quantidade: number;
}> {
  const catalog = await carregarCatalogoTagsComentarioOrganico();
  const { motivos } = comentarioOrganicoDisparaAlerta(AMOSTRA, catalog);
  const preview = montarEmailComentarioOrganico(AMOSTRA, catalog, motivos);
  return {
    subject: preview.subject,
    html: preview.html,
    resumo: 'Preview de exemplo (disparo por evento ao gravar comentário no Orgânico).',
    quantidade: 1,
  };
}

export async function executarAlertaComentarioOrganicoAmostra(
  _prismaClient: PrismaClient,
  destinatarios: string[]
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  const emails = [...new Set(destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (emails.length === 0) {
    return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  }

  const catalog = await carregarCatalogoTagsComentarioOrganico();
  const { motivos } = comentarioOrganicoDisparaAlerta(AMOSTRA, catalog);
  const { subject, html } = montarEmailComentarioOrganico(AMOSTRA, catalog, motivos);

  try {
    await sendSystemEmail(prisma, { to: emails, subject, html });
    return { enviados: 1, ignorados: 0, erros: [] };
  } catch (err) {
    return {
      enviados: 0,
      ignorados: 0,
      erros: [err instanceof Error ? err.message : String(err)],
    };
  }
}

export async function dispararAlertaComentarioOrganico(
  input: OrganicoComentarioAlertaInput,
  origem: OrigemNotificacao = 'evento'
): Promise<void> {
  const catalog = await carregarCatalogoTagsComentarioOrganico();
  const { dispara, motivos } = comentarioOrganicoDisparaAlerta(input, catalog);
  if (!dispara) return;

  const tipo = await buscarTipoEmailPorCode(ORGANICO_COMENTARIO_ALERTA_EMAIL_CODE);
  if (!tipo || !tipo.ativo) return;

  await comExecucaoRegistrada(
    { canal: 'email', tipoCode: tipo.code, tipoId: tipo.id, origem },
    async () => {
      const destinatarios = emailsDoTipo(tipo);
      if (destinatarios.length === 0) {
        return {
          result: undefined as void,
          forcarSkipped: true,
          status: 'skipped' as const,
          resumo: 'Nenhum destinatário com e-mail válido',
          tentativas: [],
        };
      }

      const { subject, html } = montarEmailComentarioOrganico(input, catalog, motivos);
      const dryRun = !envioNotificacoesHabilitado();

      try {
        await sendSystemEmail(prisma, { to: destinatarios, subject, html });
        console.log(
          `[organicoComentarioAlerta] ${dryRun ? 'dry-run' : 'enviado'} para ${destinatarios.join(', ')} — ${subject}`
        );
        return {
          result: undefined as void,
          tentativas: destinatarios.map((email) => ({
            canal: 'email' as const,
            destinatario: email,
            ok: true,
            dryRun,
          })),
          metadados: {
            colaboradorNome: input.colaboradorNome,
            colaboradorMatricula: input.colaboradorMatricula,
            motivos,
            dryRun,
          },
          resumo: `Comentário em ${input.colaboradorNome} (${labelMotivos(motivos)})`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[organicoComentarioAlerta] Falha no envio:', msg);
        return {
          result: undefined as void,
          status: 'failed' as const,
          erroMensagem: msg,
          resumo: 'Falha no envio',
          tentativas: destinatarios.map((email) => ({
            canal: 'email' as const,
            destinatario: email,
            ok: false,
            erro: msg,
          })),
        };
      }
    }
  );
}

export async function dispararAlertasComentariosOrganico(
  comentarios: OrganicoComentarioAlertaInput[]
): Promise<void> {
  for (const comentario of comentarios) {
    try {
      await dispararAlertaComentarioOrganico(comentario);
    } catch (err) {
      console.error(
        '[organicoComentarioAlerta]',
        comentario.colaboradorNome,
        err instanceof Error ? err.message : err
      );
    }
  }
}
