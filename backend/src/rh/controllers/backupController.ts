import type { Request, Response } from 'express';
import { exportRhBackup, importRhBackup } from '../repositories/backupRepository.js';
import { sendError } from '../utils/rhHelpers.js';

export async function rhBackupExportHandler(_req: Request, res: Response) {
  try {
    res.json(await exportRhBackup());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function rhBackupImportHandler(req: Request, res: Response) {
  try {
    const payload = req.body as { tables?: Record<string, unknown[]> };
    res.json(await importRhBackup(payload));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
