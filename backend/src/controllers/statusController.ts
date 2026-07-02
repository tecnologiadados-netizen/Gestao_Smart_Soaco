import type { Request, Response } from 'express';
import { getLastUpload, getLastSyncErp } from '../config/statusApp.js';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

/**
 * GET /api/status - últimos upload, sincronização ERP e status da conexão Nomus.
 */
export async function getStatus(_req: Request, res: Response): Promise<void> {
  const lastUpload = getLastUpload();
  const lastSyncErp = getLastSyncErp();
  let nomusOk: boolean = false;
  let nomusError: string | null = null;

  if (isNomusEnabled()) {
    const pool = getNomusPool();
    if (pool) {
      try {
        await pool.query('SELECT 1');
        nomusOk = true;
      } catch (err) {
        nomusOk = false;
        nomusError = err instanceof Error ? err.message : String(err);
      }
    } else {
      nomusError = 'Pool não inicializado';
    }
  } else {
    nomusError = 'NOMUS_DB_URL não configurado';
  }

  res.json({
    lastUpload: lastUpload ? lastUpload.toISOString() : null,
    lastSyncErp: lastSyncErp ? lastSyncErp.toISOString() : null,
    nomusOk,
    nomusError,
  });
}
