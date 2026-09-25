import type { PrismaClient } from '@prisma/client';
import { buildSystemEmailHtml } from '../emailHtmlTemplate.js';
import { sendSystemEmail } from '../systemEmail.js';
import { delayEntreDestinatariosMs, sendWhatsAppTextTo } from '../evolutionApi.js';
import { normalizarDestinoEnvioWhatsApp } from '../../utils/whatsappDestino.js';
import {
  calcularDiasRestantes,
  calcularDueStatus,
  calcularProximaData,
  formatarDataBr,
  marcoDisparaWhatsapp,
  marcosAlertaAplicaveis,
  marcosTarefaAplicaveis,
  mensagemAlertaValidade,
  type ValidadeMarcoDias,
} from './sgqDateRules.js';
import { resolveAppBaseUrl } from '../../config/appBaseUrl.js';

export type SgqAlertaCanal = 'email' | 'whatsapp';

export type SgqAlertaExecOpts = {
  canal: SgqAlertaCanal;
  extraLogins?: string[];
  extraTelefones?: string[];
  overrideEmails?: string[];
  overrideTelefones?: string[];
  ignorarDedup?: boolean;
};

export type SgqAlertaBuilderResult = {
  enviados: number;
  ignorados: number;
  erros: string[];
};

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

function normalizarTelefoneUsuario(raw: string | null | undefined): string | null {
  return normalizarDestinoEnvioWhatsApp(raw);
}

async function resolveTelefonesByLogins(prisma: PrismaClient, logins: string[]): Promise<string[]> {
  const unique = [...new Set(logins.map((l) => l.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await prisma.usuario.findMany({
    where: { login: { in: unique }, ativo: true },
    select: { telefone: true },
  });
  const numeros = new Set<string>();
  for (const u of users) {
    const n = normalizarTelefoneUsuario(u.telefone);
    if (n) numeros.add(n);
  }
  return [...numeros];
}

function mergeLogins(entity: string[], extra: string[] | undefined): string[] {
  return [...new Set([...entity, ...(extra ?? [])].map((l) => l.trim()).filter(Boolean))];
}

function emptyResult(): SgqAlertaBuilderResult {
  return { enviados: 0, ignorados: 0, erros: [] };
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
  html: string,
  ignorarDedup?: boolean
): Promise<'enviado' | 'ignorado'> {
  if (to.length === 0) return 'ignorado';
  if (!ignorarDedup && (await alreadySent(prisma, chave))) return 'ignorado';
  await sendSystemEmail(prisma, { to, subject, html });
  if (!ignorarDedup) await logSent(prisma, categoria, chave, to, subject);
  return 'enviado';
}

async function sendWhatsAppAndLog(
  prisma: PrismaClient,
  categoria: string,
  chave: string,
  to: string[],
  assunto: string,
  texto: string,
  ignorarDedup?: boolean
): Promise<{ status: 'enviado' | 'ignorado'; erros: string[] }> {
  if (to.length === 0) return { status: 'ignorado', erros: [] };
  if (!ignorarDedup && (await alreadySent(prisma, chave))) {
    return { status: 'ignorado', erros: [] };
  }

  const delayMs = delayEntreDestinatariosMs();
  const erros: string[] = [];
  let anyOk = false;
  for (let i = 0; i < to.length; i++) {
    const numero = to[i]!;
    const result = await sendWhatsAppTextTo(numero, texto);
    if (result.ok) anyOk = true;
    else erros.push(`${numero}: ${result.error ?? 'erro'}`);
    if (i < to.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (anyOk && !ignorarDedup) {
    await logSent(prisma, categoria, chave, to, assunto);
  }
  return { status: anyOk ? 'enviado' : 'ignorado', erros };
}

function textoWhatsAppValidade(input: {
  codigo: string;
  titulo: string;
  validade: string;
  situacao: string;
  link: string;
}): string {
  return [
    '📄 *Validade de documento (SGQ)*',
    '',
    `*Código:* ${input.codigo}`,
    `*Título:* ${input.titulo}`,
    `*Validade:* ${input.validade}`,
    `*Situação:* ${input.situacao}`,
    '',
    `Abrir no sistema: ${input.link}`,
  ].join('\n');
}

function textoWhatsAppEquipamento(input: {
  label: string;
  codigo: string;
  descricao: string;
  proxima: string;
  status: string;
  link: string;
}): string {
  return [
    `🛠️ *${input.label} de equipamento (SGQ)*`,
    '',
    `*Código:* ${input.codigo}`,
    `*Descrição:* ${input.descricao}`,
    `*Próxima ${input.label.toLowerCase()}:* ${input.proxima}`,
    `*Status:* ${input.status}`,
    '',
    `Abrir no sistema: ${input.link}`,
  ].join('\n');
}

async function processValidadeDocumentos(
  prisma: PrismaClient,
  hoje: Date,
  opts?: SgqAlertaExecOpts
): Promise<SgqAlertaBuilderResult> {
  const canal = opts?.canal ?? 'email';
  const out = emptyResult();
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
    const logins = mergeLogins(
      [versao?.elaboradorLogin ?? '', ...(permissoes?.avisoPublicacaoEmailIds ?? [])],
      opts?.extraLogins
    );

    const emails =
      canal === 'email'
        ? opts?.overrideEmails?.length
          ? opts.overrideEmails
          : await resolveEmailsByLogins(prisma, logins)
        : [];
    const telefones =
      canal === 'whatsapp'
        ? opts?.overrideTelefones?.length
          ? opts.overrideTelefones
          : [
              ...new Set([
                ...(await resolveTelefonesByLogins(prisma, logins)),
                ...(opts?.extraTelefones ?? []),
              ]),
            ]
        : [];

    if (canal === 'email' && emails.length === 0) continue;
    if (canal === 'whatsapp' && telefones.length === 0) continue;

    const dias = calcularDiasRestantes(validade.dataValidade, hoje);
    if (dias === null) continue;

    const link = `${resolveAppBaseUrl()}/qualidade/documentos`;

    for (const marco of marcosAlertaAplicaveis(dias)) {
      if (canal === 'whatsapp' && !marcoDisparaWhatsapp(marco)) continue;

      const msg = mensagemAlertaValidade(doc.codigo, marco, dias);
      try {
        if (canal === 'email') {
          const chave = `sgq_validade:${doc.uid}:${validade.dataValidade}:${marco}`;
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
          const status = await sendAndLog(
            prisma,
            'sgq_validade',
            chave,
            emails,
            `[SGQ] ${msg}`,
            html,
            opts?.ignorarDedup
          );
          if (status === 'enviado') out.enviados++;
          else out.ignorados++;
        } else {
          const chave = `sgq_validade_wa:${doc.uid}:${validade.dataValidade}:${marco}`;
          const texto = textoWhatsAppValidade({
            codigo: doc.codigo,
            titulo: doc.titulo,
            validade: formatarDataBr(validade.dataValidade),
            situacao: msg,
            link,
          });
          const wa = await sendWhatsAppAndLog(
            prisma,
            'sgq_validade_wa',
            chave,
            telefones,
            `[SGQ] ${msg}`,
            texto,
            opts?.ignorarDedup
          );
          out.erros.push(...wa.erros);
          if (wa.status === 'enviado') out.enviados++;
          else out.ignorados++;
        }
      } catch (err) {
        out.erros.push(
          `${doc.codigo} (marco ${marco}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  return out;
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
  _doc?: DocumentoMetaParaEmail
): string[] {
  // Só o responsável da etapa — lista de aviso de publicação é para vigência, não para consenso/aprovação.
  return [...new Set([tarefa.responsavelLogin].map((l) => l.trim()).filter(Boolean))];
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
      if (ok === 'enviado') sent++;
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
      if (ok === 'enviado') sent++;
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
      if (ok === 'enviado') sent++;
    }
  }
  return sent;
}

async function processEquipamento(
  prisma: PrismaClient,
  hoje: Date,
  categoria: 'sgq_calibracao' | 'sgq_verificacao',
  tipo: 'calibracao' | 'verificacao',
  opts?: SgqAlertaExecOpts
): Promise<SgqAlertaBuilderResult> {
  const canal = opts?.canal ?? 'email';
  const out = emptyResult();
  const equipamentos = await prisma.sgqEquipamento.findMany({ where: { ativo: true } });
  const link = `${resolveAppBaseUrl()}/qualidade/calibracoes`;

  for (const eq of equipamentos) {
    const proxima =
      tipo === 'calibracao'
        ? eq.proximaCalibracao ??
          calcularProximaData(eq.ultimaCalibracao ?? undefined, eq.frequenciaCalibracaoDias)
        : calcularProximaData(eq.ultimaVerificacao ?? undefined, eq.frequenciaVerificacaoDias);

    const due = calcularDueStatus(proxima);
    if (due === 'em_dia') continue;

    const dias = calcularDiasRestantes(proxima, hoje);
    if (dias === null) continue;

    const logins = mergeLogins([eq.responsavelLogin], opts?.extraLogins);
    const emails =
      canal === 'email'
        ? opts?.overrideEmails?.length
          ? opts.overrideEmails
          : await resolveEmailsByLogins(prisma, logins)
        : [];
    const telefones =
      canal === 'whatsapp'
        ? opts?.overrideTelefones?.length
          ? opts.overrideTelefones
          : [
              ...new Set([
                ...(await resolveTelefonesByLogins(prisma, logins)),
                ...(opts?.extraTelefones ?? []),
              ]),
            ]
        : [];

    if (canal === 'email' && emails.length === 0) continue;
    if (canal === 'whatsapp' && telefones.length === 0) continue;

    const label = tipo === 'calibracao' ? 'Calibração' : 'Verificação';
    const statusLabel = due === 'vencido' ? 'Vencida' : 'Próxima do vencimento';

    for (const marco of marcosAlertaAplicaveis(dias) as ValidadeMarcoDias[]) {
      if (canal === 'whatsapp' && !marcoDisparaWhatsapp(marco)) continue;

      const dataKey = proxima ?? 'sem-data';
      try {
        if (canal === 'email') {
          const chave = `${categoria}:${eq.uid}:${dataKey}:${marco}`;
          const html = buildSystemEmailHtml({
            badge: 'ALERTA SGQ',
            title: `${label} de equipamento`,
            subtitle:
              due === 'vencido'
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
                  { label: 'Status', value: statusLabel },
                ],
              },
            ],
            cta: { label: 'Abrir calibrações', href: link },
          });
          const status = await sendAndLog(
            prisma,
            categoria,
            chave,
            emails,
            `[SGQ] ${label} — ${eq.codigo}`,
            html,
            opts?.ignorarDedup
          );
          if (status === 'enviado') out.enviados++;
          else out.ignorados++;
        } else {
          const chave = `${categoria}_wa:${eq.uid}:${dataKey}:${marco}`;
          const texto = textoWhatsAppEquipamento({
            label,
            codigo: eq.codigo,
            descricao: eq.descricao,
            proxima: formatarDataBr(proxima),
            status: statusLabel,
            link,
          });
          const wa = await sendWhatsAppAndLog(
            prisma,
            `${categoria}_wa`,
            chave,
            telefones,
            `[SGQ] ${label} — ${eq.codigo}`,
            texto,
            opts?.ignorarDedup
          );
          out.erros.push(...wa.erros);
          if (wa.status === 'enviado') out.enviados++;
          else out.ignorados++;
        }
      } catch (err) {
        out.erros.push(
          `${eq.codigo} (marco ${marco}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  return out;
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
      return 'Registro interno';
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
      if (ok === 'enviado') sent++;
    } catch (err) {
      console.error(`[sgq-email] Falha ao notificar publicação ${doc.codigo}:`, err);
    }
  }
  return sent;
}

export async function executarAlertaSgqValidade(
  prisma: PrismaClient,
  opts: SgqAlertaExecOpts
): Promise<SgqAlertaBuilderResult> {
  return processValidadeDocumentos(prisma, new Date(), opts);
}

export async function executarAlertaSgqCalibracao(
  prisma: PrismaClient,
  opts: SgqAlertaExecOpts
): Promise<SgqAlertaBuilderResult> {
  const hoje = new Date();
  const cal = await processEquipamento(prisma, hoje, 'sgq_calibracao', 'calibracao', opts);
  const ver = await processEquipamento(prisma, hoje, 'sgq_verificacao', 'verificacao', opts);
  return {
    enviados: cal.enviados + ver.enviados,
    ignorados: cal.ignorados + ver.ignorados,
    erros: [...cal.erros, ...ver.erros],
  };
}

export async function previewAlertaSgqValidade(prisma: PrismaClient): Promise<{
  quantidade: number;
  html: string;
  subject: string;
  resumo: string;
}> {
  const result = await coletarPreviewValidade(prisma);
  if (result.length === 0) {
    return {
      quantidade: 0,
      subject: '[Preview] Nenhum documento na cadeia de validade',
      html: '<p>Não há documentos vigentes com validade nos marcos de alerta (30 a 0 dias).</p>',
      resumo: 'Nenhum alerta de validade pendente.',
    };
  }
  const first = result[0]!;
  const linhas = result
    .slice(0, 15)
    .map((r) => `<li><strong>${r.codigo}</strong> — ${r.titulo}: ${r.situacao}</li>`)
    .join('');
  return {
    quantidade: result.length,
    subject: `[Preview] ${first.codigo} — ${first.situacao}`,
    html: `<p>${result.length} documento(s) na cadeia de validade.</p><ul>${linhas}</ul>`,
    resumo:
      result.length === 1
        ? `1 documento: ${first.codigo}.`
        : `${result.length} documentos na cadeia. Primeiro: ${first.codigo}.`,
  };
}

export async function previewAlertaSgqCalibracao(prisma: PrismaClient): Promise<{
  quantidade: number;
  html: string;
  subject: string;
  resumo: string;
}> {
  const result = await coletarPreviewEquipamento(prisma);
  if (result.length === 0) {
    return {
      quantidade: 0,
      subject: '[Preview] Nenhum equipamento próximo/vencido',
      html: '<p>Não há calibração ou verificação nos marcos de alerta.</p>',
      resumo: 'Nenhum alerta de calibração/verificação pendente.',
    };
  }
  const first = result[0]!;
  const linhas = result
    .slice(0, 15)
    .map((r) => `<li><strong>${r.codigo}</strong> — ${r.label}: ${r.status}</li>`)
    .join('');
  return {
    quantidade: result.length,
    subject: `[Preview] ${first.codigo} — ${first.label}`,
    html: `<p>${result.length} equipamento(s) com prazo a monitorar.</p><ul>${linhas}</ul>`,
    resumo:
      result.length === 1
        ? `1 equipamento: ${first.codigo}.`
        : `${result.length} equipamentos. Primeiro: ${first.codigo}.`,
  };
}

export async function montarDigestWhatsAppSgqValidade(prisma: PrismaClient): Promise<string> {
  const itens = await coletarPreviewValidade(prisma);
  if (itens.length === 0) throw new Error('Nenhum alerta de validade no momento.');
  const linhas = itens
    .slice(0, 10)
    .map((r) => `• ${r.codigo} — ${r.situacao}`)
    .join('\n');
  return `📄 *Validade de documentos (SGQ)*\n\n${linhas}${itens.length > 10 ? `\n… +${itens.length - 10}` : ''}`;
}

export async function montarDigestWhatsAppSgqCalibracao(prisma: PrismaClient): Promise<string> {
  const itens = await coletarPreviewEquipamento(prisma);
  if (itens.length === 0) throw new Error('Nenhum alerta de calibração/verificação no momento.');
  const linhas = itens
    .slice(0, 10)
    .map((r) => `• ${r.codigo} (${r.label}) — ${r.status}`)
    .join('\n');
  return `🛠️ *Calibração/verificação (SGQ)*\n\n${linhas}${itens.length > 10 ? `\n… +${itens.length - 10}` : ''}`;
}

async function coletarPreviewValidade(prisma: PrismaClient): Promise<
  Array<{ codigo: string; titulo: string; situacao: string }>
> {
  const hoje = new Date();
  const docs = await prisma.sgqDocumento.findMany({
    where: { status: 'vigente' },
    select: { codigo: true, titulo: true, validadeJson: true, publicacaoJson: true },
  });
  const out: Array<{ codigo: string; titulo: string; situacao: string }> = [];
  for (const doc of docs) {
    const validade = parseJson<{ ativa?: boolean; dataValidade?: string }>(doc.validadeJson);
    if (!validade?.ativa || !validade.dataValidade) continue;
    const publicacao = parseJson<{ avisarPorEmail?: boolean }>(doc.publicacaoJson);
    if (publicacao?.avisarPorEmail === false) continue;
    const dias = calcularDiasRestantes(validade.dataValidade, hoje);
    if (dias === null) continue;
    const marcos = marcosAlertaAplicaveis(dias);
    if (marcos.length === 0) continue;
    out.push({
      codigo: doc.codigo,
      titulo: doc.titulo,
      situacao: mensagemAlertaValidade(doc.codigo, marcos[marcos.length - 1]!, dias),
    });
  }
  return out;
}

async function coletarPreviewEquipamento(prisma: PrismaClient): Promise<
  Array<{ codigo: string; label: string; status: string }>
> {
  const hoje = new Date();
  const equipamentos = await prisma.sgqEquipamento.findMany({
    where: { ativo: true },
    select: {
      codigo: true,
      proximaCalibracao: true,
      ultimaCalibracao: true,
      frequenciaCalibracaoDias: true,
      ultimaVerificacao: true,
      frequenciaVerificacaoDias: true,
    },
  });
  const out: Array<{ codigo: string; label: string; status: string }> = [];
  for (const eq of equipamentos) {
    const pares: Array<{ label: string; proxima: string | undefined }> = [
      {
        label: 'Calibração',
        proxima:
          eq.proximaCalibracao ??
          calcularProximaData(eq.ultimaCalibracao ?? undefined, eq.frequenciaCalibracaoDias),
      },
      {
        label: 'Verificação',
        proxima: calcularProximaData(eq.ultimaVerificacao ?? undefined, eq.frequenciaVerificacaoDias),
      },
    ];
    for (const p of pares) {
      const due = calcularDueStatus(p.proxima);
      if (due === 'em_dia') continue;
      const dias = calcularDiasRestantes(p.proxima, hoje);
      if (dias === null || marcosAlertaAplicaveis(dias).length === 0) continue;
      out.push({
        codigo: eq.codigo,
        label: p.label,
        status: due === 'vencido' ? 'Vencida' : 'Próxima do vencimento',
      });
    }
  }
  return out;
}

export async function executarNotificacoesSgqEmail(prisma: PrismaClient): Promise<{
  validade: number;
  tarefas: number;
  calibracao: number;
  verificacao: number;
}> {
  const hoje = new Date();
  const tarefas = await processTarefas(prisma, hoje);
  return { validade: 0, tarefas, calibracao: 0, verificacao: 0 };
}
