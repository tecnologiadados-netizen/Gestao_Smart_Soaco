import type { Request, Response } from 'express';
import { getNomusPool, isNomusEnabled, isNomusTransientConnectionError } from '../config/nomusDb.js';
import { obterMetodosRessuprimentoPorCodigos } from '../services/calendarioMetodoRessuprimentoService.js';

function parseCodigos(body: unknown): string[] {
  const raw = (body as { codigos?: unknown } | null)?.codigos;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c ?? '').trim()).filter(Boolean);
}

export async function postCalendarioMetodoRessuprimento(req: Request, res: Response): Promise<void> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    res.status(503).json({ error: 'ERP (Nomus) não configurado.' });
    return;
  }
  try {
    const r = await obterMetodosRessuprimentoPorCodigos(pool, parseCodigos(req.body));
    res.json({ ok: true, ...r });
  } catch (err) {
    const msg = isNomusTransientConnectionError(err)
      ? 'Falha temporária na conexão com o ERP ao consultar método de ressuprimento. Tente novamente.'
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('[calendarioMetodoRessuprimento]', err instanceof Error ? err.message : err);
    res.status(503).json({ error: msg });
  }
}
