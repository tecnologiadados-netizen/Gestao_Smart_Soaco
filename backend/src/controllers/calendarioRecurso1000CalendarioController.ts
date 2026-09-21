/**
 * Componentes Recurso 1000 no Calendário de produção.
 * POST .../calendario-producao/recurso-1000
 * POST .../calendario-producao/recurso-1000/dia
 */

import type { Request, Response } from 'express';
import { getNomusPool, isNomusEnabled, isNomusTransientConnectionError } from '../config/nomusDb.js';
import {
  obterDiaRecurso1000,
  obterSinteticoRecurso1000,
  type DemandaCalendarioLinha,
} from '../services/calendarioRecurso1000CalendarioService.js';
import { parseFiltroMetodosRessuprimento } from '../utils/metodoRessuprimentoProduto.js';
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

function mensagemErro(err: unknown): string {
  if (isNomusTransientConnectionError(err)) {
    return 'Falha temporária na conexão com o ERP ao consultar Recurso 1000. Tente novamente.';
  }
  return err instanceof Error ? err.message : String(err);
}

function poolOr503(res: Response): ReturnType<typeof getNomusPool> | null {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    res.status(503).json({ error: 'ERP (Nomus) não configurado.' });
    return null;
  }
  return pool;
}

export async function postCalendarioRecurso1000Sintetico(req: Request, res: Response): Promise<void> {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const r = await obterSinteticoRecurso1000(
      pool,
      parseDemanda(req.body),
      parseFiltroMetodosRessuprimento(
        (req.body as Record<string, unknown>)?.metodosRessup
      )
    );
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, ...r.data });
  } catch (err) {
    const msg = mensagemErro(err);
    console.error('[calendarioRecurso1000] sintetico:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}

export async function postCalendarioRecurso1000Dia(req: Request, res: Response): Promise<void> {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const body = req.body as Record<string, unknown>;
    const dataIso = normalizarDataIsoCalendario(body?.dataIso ?? body?.data);
    const setor = body?.setor != null ? String(body.setor) : undefined;
    const r = await obterDiaRecurso1000(
      pool,
      parseDemanda(req.body),
      dataIso,
      setor,
      parseFiltroMetodosRessuprimento(body?.metodosRessup)
    );
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, ...r.data });
  } catch (err) {
    const msg = mensagemErro(err);
    console.error('[calendarioRecurso1000] dia:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}
