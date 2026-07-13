import type { PrismaClient } from '@prisma/client';
import { buildSystemEmailHtml } from '../emailHtmlTemplate.js';
import { sendSystemEmail } from '../systemEmail.js';
import {
  calcularDiasRestantes,
  calcularDueStatus,
  calcularProximaData,
  formatarDataBr,
  marcosAlertaAplicaveis,
  marcosTarefaAplicaveis,
  mensagemAlertaValidade,
  type ValidadeMarcoDias,
} from './sgqDateRules.js';
import { resolveAppBaseUrl } from '../../config/appBaseUrl.js';

type JsonRecord = Record<string, unknown>;

function parseJson<T extends JsonRecord>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveEmailsByLogins(prisma: PrismaClient, logins: string[]): Promise<string[]> {
  const unique = [...new Set(logins.map((l) => l.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await prisma.usuario.findMany({
    where: { login: { in: unique }, ativo: true },
    select: { email: true },
  });
  return [...new Set(users.map((u) => (u.email ?? '').trim().toLowerCase()).filter((e) => e.includes('@')))];
}

async function alreadySent(prisma: PrismaClient, chave: string): Promise<boolean> {
  const row = await prisma.emailDisparoLog.findUnique({ where: { chave } });
  return Boolean(row);
}

async function logSent(
  prisma: PrismaClient,
  categoria: string,
  chave: string,
  destinatarios: string[],
  assunto: string
): Promise<void> {
  await prisma.emailDisparoLog.create({
    data: {
      categoria,
      chave,
      destinatarios: JSON.stringify(destinatarios),
      assunto,
    },
  });
}

async function sendAndLog(
  prisma: PrismaClient,
  categoria: string,
  chave: string,
  to: string[],
  subject: string,
  html: string
): Promise<boolean> {
  if (to.length === 0) return false;
  if (await alreadySent(prisma, chave)) return false;
  await sendSystemEmail(prisma, { to, subject, html });
  await logSent(prisma, categoria, chave, to, subject);
  return true;
}

async function processValidadeDocumentos(prisma: PrismaClient, hoje: Date): Promise<number> {
  let sent = 0;
  const docs = await prisma.sgqDocumento.findMany({
    where: { status: 'vigente' },
    include: {
      versoes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  for (const doc of docs) {
    const validade = parseJson<{ ativa?: boolean; dataValidade?: string }>(doc.validadeJson);
    if (!validade?.ativa || !validade.dataValidade) continue;

    const publicacao = parseJson<{ avisarPorEmail?: boolean }>(doc.publicacaoJson);
    if (publicacao?.avisarPorEmail === false) continue;

    const permissoes = parseJson<{ avisoPublicacaoEmailIds?: string[] }>(doc.permissoesJson);
    const versao = doc.versoes[0];
    const logins = [
      versao?.elaboradorLogin ?? '',
      ...(permissoes?.avisoPublicacaoEmailIds ?? []),
    ];
    const emails = await resolveEmailsByLogins(prisma, logins);
    if (emails.length === 0) continue;

    const dias = calcularDiasRestantes(validade.dataValidade, hoje);
    if (dias === null) continue;

    for (const marco of marcosAlertaAplicaveis(dias)) {
      const chave = `sgq_validade:${doc.uid}:${validade.dataValidade}:${marco}`;
      const msg = mensagemAlertaValidade(doc.codigo, marco, dias);
      const link = `${resolveAppBaseUrl()}/qualidade/documentos`;
      const html = buildSystemEmailHtml({
        badge: 'ALERTA SGQ',
        title: 'Validade de documento',
        subtitle: msg,
        intro: `O documento abaixo requer atenção quanto à validade no módulo de Qualidade (SGQ).`,
        sections: [
          {
            heading: 'Dados do documento',
            rows: [
              { label: 'Código', value: doc.codigo },
              { label: 'Título', value: doc.titulo },
              { label: 'Validade', value: formatarDataBr(validade.dataValidade) },
              { label: 'Situação', value: msg },
            ],
          },
        ],
        cta: { label: 'Abrir documentos no SGQ', href: link },
      });
      const ok = await sendAndLog(
        prisma,
        'sgq_validade',
        chave,
        emails,
        `[SGQ] ${msg}`,
        html
      );
      if (ok) sent++;
    }
  }
  return sent;
}

const TIPOS_TAREFA_WORKFLOW = new Set([
  'elaborar_documento',
  'consenso_documento',
  'aprovar_documento',
  'revisar_documento',
  'revalidar_documento',
]);

export type NovaTarefaWorkflowInput = {
  uid: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  responsavelLogin: string;
  prazo: string | null;
  referenciaId: string;
};

export type DocumentoMetaParaEmail = {
  codigo: string;
  titulo: string;
  permissoes?: { avisoPublicacaoEmailIds?: string[] } | null;
  publicacao?: { avisarPorEmail?: boolean } | null;
};

function buildTaskActionHref(tipo: string, referenciaId: string): string {
  const base = `${resolveAppBaseUrl()}/qualidade/documentos/${referenciaId}`;
  switch (tipo) {
    case 'elaborar_documento':
    case 'revisar_documento':
      return `${base}/elaborar`;
    case 'consenso_documento':
      return `${base}/consenso`;
    case 'aprovar_documento':
      return `${base}/aprovacao`;
    case 'revalidar_documento':
      return `${resolveAppBaseUrl()}/qualidade/documentos?revalidar=${referenciaId}`;
    default:
      return base;
  }
}

function loginsDestinatariosTarefa(
  tarefa: NovaTarefaWorkflowInput,
  doc?: DocumentoMetaParaEmail
): string[] {
  const logins = [tarefa.responsavelLogin];
  if (doc?.publicacao?.avisarPorEmail !== false) {
    logins.push(...(doc?.permissoes?.avisoPublicacaoEmailIds ?? []));
  }
  return [...new Set(logins.map((l) => l.trim()).filter(Boolean))];
}

function buildTarefaEmailHtml(input: {
  title: string;
  subtitle: string;
  intro: string;
  tarefaTitulo: string;
  tarefaDescricao?: string | null;
  docCodigo?: string;
  docTitulo?: string;
  prazo?: string | null;
  prazoLabel?: string;
  link: string;
  ctaLabel: string;
}): string {
  const rows: Array<{ label: string; value: string }> = [];
  if (input.docCodigo) rows.push({ label: 'Documento', value: `${input.docCodigo} — ${input.docTitulo ?? ''}` });
  rows.push({ label: 'Tarefa', value: input.tarefaTitulo });
  if (input.tarefaDescricao) rows.push({ label: 'Detalhes', value: input.tarefaDescricao });
  if (input.prazo) rows.push({ label: input.prazoLabel ?? 'Prazo', value: formatarDataBr(input.prazo) });

  return buildSystemEmailHtml({
    badge: 'ALERTA SGQ',
    title: input.title,
    subtitle: input.subtitle,
    intro: input.intro,
    sections: [{ heading: 'Dados da tarefa', rows }],
    cta: { label: input.ctaLabel, href: input.link },
  });
}

/** Notifica imediatamente ao atribuir nova tarefa de workflow (criação de documento, transição de etapa). */
export async function notificarNovasTarefasWorkflow(
  prisma: PrismaClient,
  novasTarefas: NovaTarefaWorkflowInput[],
  docMetaByUid: Map<string, DocumentoMetaParaEmail>
): Promise<number> {
  if (novasTarefas.length === 0) return 0;

  const provider = await prisma.emailProviderSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!provider) {
    console.warn('[sgq-email] Credencial de e-mail não configurada; tarefas novas não notificadas.');
    return 0;
  }

  let sent = 0;
  for (const tarefa of novasTarefas) {
    if (!TIPOS_TAREFA_WORKFLOW.has(tarefa.tipo)) continue;

    const doc = docMetaByUid.get(tarefa.referenciaId);
    const logins = loginsDestinatariosTarefa(tarefa, doc);
    const emails = await resolveEmailsByLogins(prisma, logins);
    if (emails.length === 0) {
      console.warn(
        `[sgq-email] Nenhum e-mail para tarefa ${tarefa.uid} (logins: ${logins.join(', ') || '—'})`
      );
      continue;
    }

    const chave = `sgq_tarefa_nova:${tarefa.uid}`;
    const link = buildTaskActionHref(tarefa.tipo, tarefa.referenciaId);
    const html = buildTarefaEmailHtml({
      title: 'Nova tarefa no SGQ',
      subtitle: tarefa.titulo,
      intro: 'Uma nova pendência foi atribuída a você no módulo de Qualidade (SGQ).',
      tarefaTitulo: tarefa.titulo,
      tarefaDescricao: tarefa.descricao,
      docCodigo: doc?.codigo,
      docTitulo: doc?.titulo,
      prazo: tarefa.prazo,
      link,
      ctaLabel: 'Abrir tarefa no sistema',
    });

    try {
      const ok = await sendAndLog(
        prisma,
        'sgq_tarefa_nova',
        chave,
        emails,
        `[SGQ] Nova tarefa: ${tarefa.titulo}`,
        html
      );
      if (ok) sent++;
    } catch (err) {
      console.error(`[sgq-email] Falha ao notificar tarefa ${tarefa.uid}:`, err);
    }
  }
  return sent;
}

async function processTarefas(prisma: PrismaClient, hoje: Date): Promise<number> {
  let sent = 0;
  const tarefas = await prisma.sgqTarefa.findMany({
    where: { concluida: false, prazo: { not: null } },
  });

  const hojeKey = hoje.toISOString().slice(0, 10);
  const linkPendencias = `${resolveAppBaseUrl()}/qualidade/documentos`;

  for (const tarefa of tarefas) {
    if (!TIPOS_TAREFA_WORKFLOW.has(tarefa.tipo)) continue;
    if (!tarefa.prazo) continue;

    const dias = calcularDiasRestantes(tarefa.prazo, hoje);
    if (dias === null) continue;

    const emails = await resolveEmailsByLogins(prisma, [tarefa.responsavelLogin]);
    if (emails.length === 0) continue;

    if (dias < 0) {
      const chave = `sgq_tarefa:${tarefa.uid}:vencida:${hojeKey}`;
      const html = buildTarefaEmailHtml({
        title: 'Tarefa SGQ vencida',
        subtitle: 'O prazo desta atividade já foi ultrapassado.',
        intro: 'Existe uma pendência vencida aguardando sua ação no módulo de Qualidade (SGQ).',
        tarefaTitulo: tarefa.titulo,
        tarefaDescricao: tarefa.descricao,
        prazo: tarefa.prazo,
        prazoLabel: 'Prazo (vencido)',
        link: linkPendencias,
        ctaLabel: 'Abrir pendências',
      });
      const ok = await sendAndLog(prisma, 'sgq_tarefa', chave, emails, `[SGQ] Tarefa vencida: ${tarefa.titulo}`, html);
      if (ok) sent++;
      continue;
    }

    for (const marco of marcosTarefaAplicaveis(dias)) {
      const chave = `sgq_tarefa:${tarefa.uid}:${tarefa.prazo}:${marco}`;
      const html = buildTarefaEmailHtml({
        title: 'Prazo de tarefa SGQ',
        subtitle: `${dias} dia(s) restante(s) para conclusão.`,
        intro: `O alerta de prazo (${marco} dia(s)) foi acionado para a tarefa abaixo.`,
        tarefaTitulo: tarefa.titulo,
        tarefaDescricao: tarefa.descricao,
        prazo: tarefa.prazo,
        link: linkPendencias,
        ctaLabel: 'Abrir pendências',
      });
      const ok = await sendAndLog(
        prisma,
        'sgq_tarefa',
        chave,
        emails,
        `[SGQ] Prazo ${marco}d: ${tarefa.titulo}`,
        html
      );
      if (ok) sent++;
    }
  }
  return sent;
}

async function processEquipamento(
  prisma: PrismaClient,
  hoje: Date,
  categoria: 'sgq_calibracao' | 'sgq_verificacao',
  tipo: 'calibracao' | 'verificacao'
): Promise<number> {
  let sent = 0;
  const equipamentos = await prisma.sgqEquipamento.findMany({ where: { ativo: true } });

  for (const eq of equipamentos) {
    const proxima =
      tipo === 'calibracao'
        ? eq.proximaCalibracao ??
          calcularProximaData(eq.ultimaCalibracao ?? undefined, eq.frequenciaCalibracaoDias)
        : calcularProximaData(eq.ultimaVerificacao ?? undefined, eq.frequenciaVerificacaoDias);

    const status = calcularDueStatus(proxima);
    if (status === 'em_dia') continue;

    const dias = calcularDiasRestantes(proxima, hoje);
    if (dias === null) continue;

    const emails = await resolveEmailsByLogins(prisma, [eq.responsavelLogin]);
    if (emails.length === 0) continue;

    const label = tipo === 'calibracao' ? 'Calibração' : 'Verificação';

    for (const marco of marcosAlertaAplicaveis(dias) as ValidadeMarcoDias[]) {
      const dataKey = proxima ?? 'sem-data';
      const chave = `${categoria}:${eq.uid}:${dataKey}:${marco}`;
      const html = buildSystemEmailHtml({
        badge: 'ALERTA SGQ',
        title: `${label} de equipamento`,
        subtitle:
          status === 'vencido'
            ? 'Atividade vencida — requer atenção imediata.'
            : 'Prazo próximo do vencimento.',
        intro: `O equipamento abaixo possui ${label.toLowerCase()} com prazo a monitorar no SGQ.`,
        sections: [
          {
            heading: 'Dados do equipamento',
            rows: [
              { label: 'Código', value: eq.codigo },
              { label: 'Descrição', value: eq.descricao },
              { label: `Próxima ${label.toLowerCase()}`, value: formatarDataBr(proxima) },
              {
                label: 'Status',
                value: status === 'vencido' ? 'Vencida' : 'Próxima do vencimento',
              },
            ],
          },
        ],
        cta: { label: 'Abrir calibrações', href: `${resolveAppBaseUrl()}/qualidade/calibracoes` },
      });
      const ok = await sendAndLog(
        prisma,
        categoria,
        chave,
        emails,
        `[SGQ] ${label} — ${eq.codigo}`,
        html
      );
      if (ok) sent++;
    }
  }
  return sent;
}

export type DocumentoPublicadoInput = {
  uid: string;
  codigo: string;
  titulo: string;
  origem: string;
  versaoAtual: string;
  permissoes?: { avisoPublicacaoEmailIds?: string[] } | null;
  publicacao?: { avisarPorEmail?: boolean } | null;
};

function origemDocumentoLabel(origem: string): string {
  switch (origem) {
    case 'externo':
      return 'Documento externo';
    case 'registro':
      return 'Registro';
    default:
      return 'Documento interno';
  }
}

/** Notifica destinatários quando um documento passa a vigente (cadastro externo/registro ou aprovação). */
export async function notificarPublicacaoDocumentos(
  prisma: PrismaClient,
  documentos: DocumentoPublicadoInput[]
): Promise<number> {
  if (documentos.length === 0) return 0;

  const provider = await prisma.emailProviderSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!provider) {
    console.warn('[sgq-email] Credencial de e-mail não configurada; publicação não notificada.');
    return 0;
  }

  let sent = 0;
  for (const doc of documentos) {
    if (doc.publicacao?.avisarPorEmail === false) continue;

    const logins = [...new Set((doc.permissoes?.avisoPublicacaoEmailIds ?? []).map((l) => l.trim()).filter(Boolean))];
    if (logins.length === 0) continue;

    const emails = await resolveEmailsByLogins(prisma, logins);
    if (emails.length === 0) {
      console.warn(
        `[sgq-email] Nenhum e-mail para publicação de ${doc.codigo} (logins: ${logins.join(', ')})`
      );
      continue;
    }

    const chave = `sgq_publicacao:${doc.uid}:${doc.versaoAtual}`;
    const link = `${resolveAppBaseUrl()}/qualidade/documentos/${doc.uid}`;
    const tipoLabel = origemDocumentoLabel(doc.origem);
    const html = buildSystemEmailHtml({
      badge: 'SGQ',
      title: 'Documento publicado',
      subtitle: `${doc.codigo} — ${doc.titulo}`,
      intro: `Um ${tipoLabel.toLowerCase()} foi publicado no módulo de Qualidade (SGQ) e está disponível para consulta.`,
      sections: [
        {
          heading: 'Dados do documento',
          rows: [
            { label: 'Código', value: doc.codigo },
            { label: 'Título', value: doc.titulo },
            { label: 'Tipo', value: tipoLabel },
            { label: 'Revisão', value: doc.versaoAtual },
          ],
        },
      ],
      cta: { label: 'Abrir documento no SGQ', href: link },
    });

    try {
      const ok = await sendAndLog(
        prisma,
        'sgq_publicacao',
        chave,
        emails,
        `[SGQ] Documento publicado: ${doc.codigo}`,
        html
      );
      if (ok) sent++;
    } catch (err) {
      console.error(`[sgq-email] Falha ao notificar publicação ${doc.codigo}:`, err);
    }
  }
  return sent;
}

export async function executarNotificacoesSgqEmail(prisma: PrismaClient): Promise<{
  validade: number;
  tarefas: number;
  calibracao: number;
  verificacao: number;
}> {
  const hoje = new Date();
  const validade = await processValidadeDocumentos(prisma, hoje);
  const tarefas = await processTarefas(prisma, hoje);
  const calibracao = await processEquipamento(prisma, hoje, 'sgq_calibracao', 'calibracao');
  const verificacao = await processEquipamento(prisma, hoje, 'sgq_verificacao', 'verificacao');
  return { validade, tarefas, calibracao, verificacao };
}
