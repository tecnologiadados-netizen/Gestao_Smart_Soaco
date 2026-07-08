import type { PrismaClient } from '@prisma/client';
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

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1e293b">
    <h2 style="color:#0f172a">${title}</h2>
    ${body}
    <p style="margin-top:24px;font-size:12px;color:#64748b">Gestor de Pedidos SoAço — Qualidade (SGQ)</p>
  </body></html>`;
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
      const html = wrapHtml(
        'Alerta de validade de documento',
        `<p><strong>${doc.codigo}</strong> — ${doc.titulo}</p>
         <p>${msg}</p>
         <p>Validade: <strong>${formatarDataBr(validade.dataValidade)}</strong></p>
         <p><a href="${link}">Abrir documentos no SGQ</a></p>`
      );
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

async function processTarefas(prisma: PrismaClient, hoje: Date): Promise<number> {
  let sent = 0;
  const tarefas = await prisma.sgqTarefa.findMany({
    where: { concluida: false, prazo: { not: null } },
  });

  const hojeKey = hoje.toISOString().slice(0, 10);

  for (const tarefa of tarefas) {
    if (!TIPOS_TAREFA_WORKFLOW.has(tarefa.tipo)) continue;
    if (!tarefa.prazo) continue;

    const dias = calcularDiasRestantes(tarefa.prazo, hoje);
    if (dias === null) continue;

    const emails = await resolveEmailsByLogins(prisma, [tarefa.responsavelLogin]);
    if (emails.length === 0) continue;

    if (dias < 0) {
      const chave = `sgq_tarefa:${tarefa.uid}:vencida:${hojeKey}`;
      const html = wrapHtml(
        'Tarefa SGQ vencida',
        `<p><strong>${tarefa.titulo}</strong></p>
         <p>${tarefa.descricao ?? ''}</p>
         <p>Prazo: <strong>${formatarDataBr(tarefa.prazo)}</strong> (vencida)</p>
         <p><a href="${resolveAppBaseUrl()}/qualidade/documentos">Abrir pendências</a></p>`
      );
      const ok = await sendAndLog(prisma, 'sgq_tarefa', chave, emails, `[SGQ] Tarefa vencida: ${tarefa.titulo}`, html);
      if (ok) sent++;
      continue;
    }

    for (const marco of marcosTarefaAplicaveis(dias)) {
      const chave = `sgq_tarefa:${tarefa.uid}:${tarefa.prazo}:${marco}`;
      const html = wrapHtml(
        'Prazo de tarefa SGQ',
        `<p><strong>${tarefa.titulo}</strong></p>
         <p>Prazo: <strong>${formatarDataBr(tarefa.prazo)}</strong> (${dias} dia(s) restante(s))</p>
         <p><a href="${resolveAppBaseUrl()}/qualidade/documentos">Abrir pendências</a></p>`
      );
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
      const html = wrapHtml(
        `${label} de equipamento`,
        `<p><strong>${eq.codigo}</strong> — ${eq.descricao}</p>
         <p>Próxima ${label.toLowerCase()}: <strong>${formatarDataBr(proxima)}</strong></p>
         <p>Status: ${status === 'vencido' ? 'Vencida' : 'Próxima do vencimento'}</p>
         <p><a href="${resolveAppBaseUrl()}/qualidade/calibracoes">Abrir calibrações</a></p>`
      );
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
