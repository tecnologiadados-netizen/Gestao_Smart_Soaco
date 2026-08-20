/**
 * Double CheckIn — parâmetros locais (limiar) + ensure tipo WhatsApp + dedup alerta.
 */

import { prisma } from '../config/prisma.js';
import {
  buscarTipoPorCode,
  listarUsuariosParaDestinatario,
  salvarDestinatarios,
  type GrupoDestinoInput,
  type UsuarioDestinatarioRow,
} from './whatsappNotificacaoRepository.js';

export const DOUBLE_CHECKIN_WA_CODE = 'compras_double_checkin';
export const DOUBLE_CHECKIN_LIMIAR_KEY = 'double_checkin_limiar_pct';
export const DOUBLE_CHECKIN_LIMIAR_DEFAULT = 10;
/** A partir desta data (emissão NF) o sync pode enviar WhatsApp. Histórico anterior só é marcado. */
export const DOUBLE_CHECKIN_ALERTA_DESDE_KEY = 'double_checkin_alerta_desde';

function ymdHojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function ensureDoubleCheckInWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: DOUBLE_CHECKIN_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: DOUBLE_CHECKIN_WA_CODE,
      label: 'Double CheckIn — variação de preço',
      descricao:
        'Enviada quando uma NF de entrada com emissão a partir da data de go-live tem item com variação de preço acima do limiar. Histórico anterior não gera WhatsApp.',
      ativo: true,
      sortOrder: 45,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}

export async function getDoubleCheckInLimiarPct(): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key: DOUBLE_CHECKIN_LIMIAR_KEY } });
  const n = Number(row?.value ?? DOUBLE_CHECKIN_LIMIAR_DEFAULT);
  if (!Number.isFinite(n) || n <= 0) return DOUBLE_CHECKIN_LIMIAR_DEFAULT;
  return Math.min(100, Math.max(0.1, n));
}

export async function setDoubleCheckInLimiarPct(limiarPct: number): Promise<number> {
  const n = Number(limiarPct);
  if (!Number.isFinite(n) || n <= 0 || n > 100) {
    throw new Error('Limiar deve ser um número entre 0,1 e 100.');
  }
  const value = String(Math.round(n * 100) / 100);
  await prisma.config.upsert({
    where: { key: DOUBLE_CHECKIN_LIMIAR_KEY },
    create: { key: DOUBLE_CHECKIN_LIMIAR_KEY, value },
    update: { value },
  });
  return Number(value);
}

/**
 * Data (YYYY-MM-DD) a partir da qual alertas WhatsApp são permitidos.
 * Na primeira leitura, grava o dia corrente (SP) — go-live sem flood histórico.
 */
export async function getOrCreateDoubleCheckInAlertaDesdeYmd(): Promise<string> {
  const row = await prisma.config.findUnique({ where: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY } });
  const existing = String(row?.value ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(existing)) return existing;

  const value = ymdHojeSaoPaulo();
  await prisma.config.upsert({
    where: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY },
    create: { key: DOUBLE_CHECKIN_ALERTA_DESDE_KEY, value },
    update: { value },
  });
  return value;
}

export async function getDoubleCheckInDestinatarios(): Promise<{
  tipoId: number;
  usuarioIds: number[];
  grupos: { jid: string; nome: string | null }[];
  usuarios: UsuarioDestinatarioRow[];
}> {
  const tipo = await ensureDoubleCheckInWhatsappTipo();
  const full = await buscarTipoPorCode(DOUBLE_CHECKIN_WA_CODE);
  const usuarios = await listarUsuariosParaDestinatario();
  return {
    tipoId: tipo.id,
    usuarioIds: (full?.destinatarios ?? []).map((d) => d.usuarioId),
    grupos: (full?.grupos ?? []).map((g) => ({ jid: g.jid, nome: g.nome })),
    usuarios,
  };
}

export async function setDoubleCheckInDestinatarios(
  usuarioIds: number[],
  grupos: GrupoDestinoInput[] = []
): Promise<{
  tipoId: number;
  usuarioIds: number[];
  grupos: { jid: string; nome: string | null }[];
}> {
  const tipo = await ensureDoubleCheckInWhatsappTipo();
  const tipos = await salvarDestinatarios(tipo.id, usuarioIds, grupos);
  const row = tipos.find((t) => t.code === DOUBLE_CHECKIN_WA_CODE) ?? tipos.find((t) => t.id === tipo.id);
  return {
    tipoId: tipo.id,
    usuarioIds: row?.destinatarioIds ?? [],
    grupos: row?.grupos ?? [],
  };
}

export async function listarDocumentosJaAlertados(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.doubleCheckInAlertaEnviado.findMany({
    where: { idDocumentoEstoque: { in: ids } },
    select: { idDocumentoEstoque: true },
  });
  return new Set(rows.map((r) => r.idDocumentoEstoque));
}

export async function marcarAlertaEnviado(
  idDocumentoEstoque: number,
  resumo: string
): Promise<void> {
  await prisma.doubleCheckInAlertaEnviado.upsert({
    where: { idDocumentoEstoque },
    create: { idDocumentoEstoque, resumo: resumo.slice(0, 2000) },
    update: { resumo: resumo.slice(0, 2000), enviadoEm: new Date() },
  });
}

export type DoubleCheckInConferidoInfo = {
  idDocumentoEstoque: number;
  conferidoEm: string;
  usuarioId: number;
  usuarioLogin: string;
};

export async function listarDocumentosConferidos(
  ids: number[]
): Promise<Map<number, DoubleCheckInConferidoInfo>> {
  const map = new Map<number, DoubleCheckInConferidoInfo>();
  if (ids.length === 0) return map;
  const rows = await prisma.doubleCheckInConferido.findMany({
    where: { idDocumentoEstoque: { in: ids } },
  });
  for (const r of rows) {
    map.set(r.idDocumentoEstoque, {
      idDocumentoEstoque: r.idDocumentoEstoque,
      conferidoEm: r.conferidoEm.toISOString(),
      usuarioId: r.usuarioId,
      usuarioLogin: r.usuarioLogin,
    });
  }
  return map;
}

/** Todos os documentos já conferidos (para cruzar com período Nomus no dashboard). */
export async function listarTodosDocumentosConferidos(): Promise<
  Map<number, DoubleCheckInConferidoInfo>
> {
  const map = new Map<number, DoubleCheckInConferidoInfo>();
  const rows = await prisma.doubleCheckInConferido.findMany();
  for (const r of rows) {
    map.set(r.idDocumentoEstoque, {
      idDocumentoEstoque: r.idDocumentoEstoque,
      conferidoEm: r.conferidoEm.toISOString(),
      usuarioId: r.usuarioId,
      usuarioLogin: r.usuarioLogin,
    });
  }
  return map;
}

/** IDs com outlier já detectado na sync (resumo ≠ sem-outlier / baseline). */
export async function listarIdsComAtencaoDetectada(): Promise<Set<number>> {
  const rows = await prisma.doubleCheckInAlertaEnviado.findMany({
    select: { idDocumentoEstoque: true, resumo: true },
  });
  const set = new Set<number>();
  for (const r of rows) {
    const resumo = String(r.resumo ?? '').trim();
    if (!resumo) continue;
    if (resumo === 'sem-outlier') continue;
    if (resumo.startsWith('baseline-')) continue;
    set.add(r.idDocumentoEstoque);
  }
  return set;
}

export async function getDocumentoConferido(
  idDocumentoEstoque: number
): Promise<DoubleCheckInConferidoInfo | null> {
  const r = await prisma.doubleCheckInConferido.findUnique({
    where: { idDocumentoEstoque },
  });
  if (!r) return null;
  return {
    idDocumentoEstoque: r.idDocumentoEstoque,
    conferidoEm: r.conferidoEm.toISOString(),
    usuarioId: r.usuarioId,
    usuarioLogin: r.usuarioLogin,
  };
}

export async function marcarDocumentoConferido(params: {
  idDocumentoEstoque: number;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<DoubleCheckInConferidoInfo> {
  const existing = await prisma.doubleCheckInConferido.findUnique({
    where: { idDocumentoEstoque: params.idDocumentoEstoque },
  });
  if (existing) {
    return {
      idDocumentoEstoque: existing.idDocumentoEstoque,
      conferidoEm: existing.conferidoEm.toISOString(),
      usuarioId: existing.usuarioId,
      usuarioLogin: existing.usuarioLogin,
    };
  }
  const created = await prisma.doubleCheckInConferido.create({
    data: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
  });
  return {
    idDocumentoEstoque: created.idDocumentoEstoque,
    conferidoEm: created.conferidoEm.toISOString(),
    usuarioId: created.usuarioId,
    usuarioLogin: created.usuarioLogin,
  };
}
