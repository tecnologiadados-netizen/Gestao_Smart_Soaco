/**
 * Disponibilidade de materiais do Calendário de produção.
 * POST /api/pedidos/sequenciamento-carradas/calendario-producao/disponibilidade-materiais
 * POST .../disponibilidade-materiais/dia
 * POST .../disponibilidade-materiais/item
 */

import type { Request, Response } from 'express';
import { getNomusPool, isNomusEnabled, isNomusTransientConnectionError } from '../config/nomusDb.js';
import {
  obterDisponibilidadeSintetica,
  obterHorizonteItem,
  obterMateriaisDoDia,
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
    });
  }
  return out;
}

function mensagemErroDisponibilidade(err: unknown): string {
  if (isNomusTransientConnectionError(err)) {
    return 'Falha temporária na conexão com o ERP ao consultar materiais. Tente novamente.';
  }
  return err instanceof Error ? err.message : String(err);
}

export async function postDisponibilidadeMateriaisSintetica(req: Request, res: Response): Promise<void> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    res.status(503).json({ error: 'ERP (Nomus) não configurado.' });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const r = await obterDisponibilidadeSintetica(pool, demanda);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] sintetico:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}

export async function postDisponibilidadeMateriaisDia(req: Request, res: Response): Promise<void> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    res.status(503).json({ error: 'ERP (Nomus) não configurado.' });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const body = req.body as Record<string, unknown>;
    // Aceita dataIso ou data; normaliza dd/MM/yyyy → YYYY-MM-DD.
    const dataIso = normalizarDataIsoCalendario(body?.dataIso ?? body?.data);
    const r = await obterMateriaisDoDia(pool, demanda, dataIso);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] dia:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}

export async function postDisponibilidadeMateriaisItem(req: Request, res: Response): Promise<void> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    res.status(503).json({ error: 'ERP (Nomus) não configurado.' });
    return;
  }
  try {
    const demanda = parseDemanda(req.body);
    const codigoComponente = String(
      (req.body as Record<string, unknown>)?.codigoComponente ?? ''
    ).trim();
    const r = await obterHorizonteItem(pool, demanda, codigoComponente);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, ...r.data });
  } catch (err) {
    const msg = mensagemErroDisponibilidade(err);
    console.error('[disponibilidadeMateriais] item:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}
