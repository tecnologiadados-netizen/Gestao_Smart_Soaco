/**
 * Ledger de execuções/tentativas de notificações (WhatsApp e e-mail).
 * Espelha o padrão scheduled_alert_runs + action_results do Otimiza.
 */

import { prisma } from '../config/prisma.js';

export type CanalNotificacao = 'whatsapp' | 'email';
export type OrigemNotificacao = 'cron' | 'catchup' | 'evento' | 'teste';
export type StatusNotificacaoExecucao =
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'partial';

export type TentativaInput = {
  canal: CanalNotificacao;
  destinatario: string;
  usuarioId?: number | null;
  ok: boolean;
  dryRun?: boolean;
  erro?: string | null;
};

export type ExecucaoHistoricoItem = {
  id: number;
  canal: CanalNotificacao;
  tipoCode: string;
  tipoId: number | null;
  origem: string;
  status: StatusNotificacaoExecucao;
  iniciadoEm: string;
  finalizadoEm: string | null;
  resumo: string | null;
  erroMensagem: string | null;
  metadados: Record<string, unknown> | null;
  tentativas: Array<{
    id: number;
    canal: string;
    destinatario: string;
    usuarioId: number | null;
    ok: boolean;
    dryRun: boolean;
    erro: string | null;
    enviadoEm: string;
  }>;
};

const RETENCAO_DIAS = 90;

function safeJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Abre uma execução (status running). Falhas de persistência não propagam. */
export async function iniciarExecucao(input: {
  canal: CanalNotificacao;
  tipoCode: string;
  tipoId?: number | null;
  origem: OrigemNotificacao;
  metadados?: Record<string, unknown>;
}): Promise<number | null> {
  try {
    const row = await prisma.notificacaoExecucao.create({
      data: {
        canal: input.canal,
        tipoCode: input.tipoCode,
        tipoId: input.tipoId ?? null,
        origem: input.origem,
        status: 'running',
        metadadosJson: safeJson(input.metadados),
      },
    });
    return row.id;
  } catch (err) {
    console.error('[notificacaoExecucao] iniciar:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function derivarStatus(tentativas: TentativaInput[], opts?: {
  erroMensagem?: string | null;
  forcarSkipped?: boolean;
}): StatusNotificacaoExecucao {
  if (opts?.forcarSkipped) return 'skipped';
  if (opts?.erroMensagem && tentativas.length === 0) return 'failed';
  if (tentativas.length === 0) return 'skipped';
  const oks = tentativas.filter((t) => t.ok);
  const fails = tentativas.filter((t) => !t.ok);
  if (fails.length === 0) return 'success';
  if (oks.length === 0) return 'failed';
  return 'partial';
}

export function montarResumo(tentativas: TentativaInput[], extra?: {
  ignorados?: number;
  mensagem?: string;
}): string {
  if (extra?.mensagem) return extra.mensagem;
  const enviados = tentativas.filter((t) => t.ok && !t.dryRun).length;
  const dryRuns = tentativas.filter((t) => t.ok && t.dryRun).length;
  const erros = tentativas.filter((t) => !t.ok).length;
  const parts: string[] = [];
  if (enviados > 0) parts.push(`${enviados} enviado(s)`);
  if (dryRuns > 0) parts.push(`${dryRuns} dry-run`);
  if (erros > 0) parts.push(`${erros} erro(s)`);
  if (extra?.ignorados && extra.ignorados > 0) parts.push(`${extra.ignorados} ignorado(s)`);
  return parts.length > 0 ? parts.join(', ') : 'Sem disparo';
}

/** Fecha a execução com status, resumo e tentativas. */
export async function finalizarExecucao(
  execucaoId: number | null,
  input: {
    status?: StatusNotificacaoExecucao;
    resumo?: string | null;
    erroMensagem?: string | null;
    metadados?: Record<string, unknown>;
    tentativas?: TentativaInput[];
    forcarSkipped?: boolean;
  }
): Promise<void> {
  if (execucaoId == null) return;
  try {
    const tentativas = input.tentativas ?? [];
    const status =
      input.status ??
      derivarStatus(tentativas, {
        erroMensagem: input.erroMensagem,
        forcarSkipped: input.forcarSkipped,
      });
    const resumo =
      input.resumo ??
      montarResumo(tentativas, {
        ignorados:
          typeof input.metadados?.ignorados === 'number' ? input.metadados.ignorados : undefined,
      });

    await prisma.$transaction(async (tx) => {
      if (tentativas.length > 0) {
        await tx.notificacaoTentativa.createMany({
          data: tentativas.map((t) => ({
            execucaoId,
            canal: t.canal,
            destinatario: t.destinatario.slice(0, 500),
            usuarioId: t.usuarioId ?? null,
            ok: t.ok,
            dryRun: Boolean(t.dryRun),
            erro: t.erro ? t.erro.slice(0, 2000) : null,
          })),
        });
      }
      await tx.notificacaoExecucao.update({
        where: { id: execucaoId },
        data: {
          status,
          resumo: resumo?.slice(0, 1000) ?? null,
          erroMensagem: input.erroMensagem ? input.erroMensagem.slice(0, 2000) : null,
          finalizadoEm: new Date(),
          ...(input.metadados
            ? { metadadosJson: safeJson(input.metadados) }
            : {}),
        },
      });
    });
  } catch (err) {
    console.error('[notificacaoExecucao] finalizar:', err instanceof Error ? err.message : err);
  }
}

/** Atalho: inicia, executa callback e finaliza (sucesso ou falha). */
export async function comExecucaoRegistrada<T>(
  meta: {
    canal: CanalNotificacao;
    tipoCode: string;
    tipoId?: number | null;
    origem: OrigemNotificacao;
  },
  run: (execucaoId: number | null) => Promise<{
    tentativas?: TentativaInput[];
    status?: StatusNotificacaoExecucao;
    resumo?: string | null;
    erroMensagem?: string | null;
    metadados?: Record<string, unknown>;
    forcarSkipped?: boolean;
    result: T;
  }>
): Promise<T> {
  const execucaoId = await iniciarExecucao(meta);
  try {
    const out = await run(execucaoId);
    await finalizarExecucao(execucaoId, {
      tentativas: out.tentativas,
      status: out.status,
      resumo: out.resumo,
      erroMensagem: out.erroMensagem,
      metadados: out.metadados,
      forcarSkipped: out.forcarSkipped,
    });
    return out.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finalizarExecucao(execucaoId, {
      status: 'failed',
      erroMensagem: msg,
      resumo: 'Falha na execução',
      tentativas: [],
    });
    throw err;
  }
}

export async function listarHistoricoPorTipo(input: {
  canal: CanalNotificacao;
  tipoCode?: string;
  tipoId?: number;
  limit?: number;
}): Promise<ExecucaoHistoricoItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const or: Array<{ tipoId?: number; tipoCode?: string }> = [];
  if (input.tipoId != null) or.push({ tipoId: input.tipoId });
  if (input.tipoCode) or.push({ tipoCode: input.tipoCode });

  const where =
    or.length > 0
      ? { canal: input.canal, OR: or }
      : { canal: input.canal };

  const rows = await prisma.notificacaoExecucao.findMany({
    where,
    orderBy: { iniciadoEm: 'desc' },
    take: limit,
    include: {
      tentativas: { orderBy: { enviadoEm: 'asc' } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    canal: r.canal as CanalNotificacao,
    tipoCode: r.tipoCode,
    tipoId: r.tipoId,
    origem: r.origem,
    status: r.status as StatusNotificacaoExecucao,
    iniciadoEm: r.iniciadoEm.toISOString(),
    finalizadoEm: r.finalizadoEm?.toISOString() ?? null,
    resumo: r.resumo,
    erroMensagem: r.erroMensagem,
    metadados: parseJson(r.metadadosJson),
    tentativas: r.tentativas.map((t) => ({
      id: t.id,
      canal: t.canal,
      destinatario: t.destinatario,
      usuarioId: t.usuarioId,
      ok: t.ok,
      dryRun: t.dryRun,
      erro: t.erro,
      enviadoEm: t.enviadoEm.toISOString(),
    })),
  }));
}

/** Limpa execuções antigas (chamado ocasionalmente ao listar). */
export async function limparHistoricoAntigo(): Promise<void> {
  try {
    const limite = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000);
    await prisma.notificacaoExecucao.deleteMany({
      where: { iniciadoEm: { lt: limite } },
    });
  } catch {
    /* ignore */
  }
}
