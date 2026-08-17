/**
 * Disponibilidade de materiais do Calendário de produção.
 * POST /api/pedidos/sequenciamento-carradas/calendario-producao/disponibilidade-materiais
 * POST .../disponibilidade-materiais/dia
 * POST .../disponibilidade-materiais/item
 *
 * Com `snapshotId` no body o cálculo usa a base congelada no Gravar (sem tocar no Nomus);
 * sem ele, ou em snapshot legado sem base, consulta ao vivo.
 */

import type { Request, Response } from 'express';
import { getNomusPool, isNomusEnabled, isNomusTransientConnectionError } from '../config/nomusDb.js';
import { obterBaseMateriaisSnapshot } from '../data/sequenciamentoCarradasRepository.js';
import {
  obterDisponibilidadeSintetica,
  obterHorizonteItem,
  obterMateriaisDoDia,
  type BaseMateriaisCongelada,
  type DemandaCalendarioLinha,
} from '../services/disponibilidadeMateriaisCalendarioService.js';
import { normalizarDataIsoCalendario } from '../utils/disponibilidadeMateriaisCalendarioDerivados.js';

function parseDemanda(body: unknown): DemandaCalendarioLinha[] {
  const b = body as Record<string, unknown> | null | undefined;
  const raw = b?.demanda;
  if (!Array.isArray(raw)) return [];
  const out: DemandaCalendarioLinha[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    out.push({
      codigoPa: String(r.codigoPa ?? '').trim(),
      qtde: Number(r.qtde),
      dataIso: normalizarDataIsoCalendario(r.dataIso),
      pd: r.pd != null ? String(r.pd) : undefined,
      setor: r.setor != null ? String(r.setor) : undefined,
      carrada: r.carrada != null ? String(r.carrada) : undefined,
    });
  }
  return out;
}

function parseSnapshotId(body: unknown): number | null {
  const raw = (body as Record<string, unknown> | null | undefined)?.snapshotId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mensagemErroDisponibilidade(err: unknown): string {
  if (isNomusTransientConnectionError(err)) {
    return 'Falha temporária na conexão com o ERP ao consultar materiais. Tente novamente.';
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Resolve a fonte do cálculo. Com base congelada o pool é dispensável — o snapshot continua
 * abrindo mesmo com o ERP fora do ar.
 */
async function resolverFonte(
  body: unknown
): Promise<
  | { ok: true; pool: ReturnType<typeof getNomusPool>; base: BaseMateriaisCongelada | null }
  | { ok: false; error: string }
> {
  const snapshotId = parseSnapshotId(body);
  const base = snapshotId != null ? await obterBaseMateriaisSnapshot(snapshotId) : null;
  if (base) return { ok: true, pool: null, base };
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { ok: false, error: 'ERP (Nomus) não configurado.' };
  return { ok: true, pool, base: null };
}

export async function postDisponibilidadeMateriaisSintetica(req: Request, res: Response): Promise<void> {
  const fonte = await resolverFonte(req.body);
  if (!fonte.ok) {
    res.status(503).json({ error: fonte.error });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const r = await obterDisponibilidadeSintetica(fonte.pool, demanda, fonte.base);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, congelado: fonte.base != null, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] sintetico:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}

export async function postDisponibilidadeMateriaisDia(req: Request, res: Response): Promise<void> {
  const fonte = await resolverFonte(req.body);
  if (!fonte.ok) {
    res.status(503).json({ error: fonte.error });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const body = req.body as Record<string, unknown>;
    // Aceita dataIso ou data; normaliza dd/MM/yyyy → YYYY-MM-DD.
    const dataIso = normalizarDataIsoCalendario(body?.dataIso ?? body?.data);
    const setor = body?.setor != null ? String(body.setor) : undefined;
    const r = await obterMateriaisDoDia(fonte.pool, demanda, dataIso, fonte.base, setor);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, congelado: fonte.base != null, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] dia:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}

export async function postDisponibilidadeMateriaisItem(req: Request, res: Response): Promise<void> {
  const fonte = await resolverFonte(req.body);
  if (!fonte.ok) {
    res.status(503).json({ error: fonte.error });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const codigoComponente = String(
      (req.body as Record<string, unknown>)?.codigoComponente ?? ''
    ).trim();
    const r = await obterHorizonteItem(fonte.pool, demanda, codigoComponente, fonte.base);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, congelado: fonte.base != null, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] item:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}
