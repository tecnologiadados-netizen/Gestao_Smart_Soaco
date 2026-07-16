import type { Request, Response } from 'express';
import { getConfig, setConfig } from '../repositories/configRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

export async function getConfigHandler(req: Request, res: Response) {
  try {
    const key = s(req.query.key) || 'logo';
    const value = await getConfig(key);
    res.json({ value });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function setConfigHandler(req: Request, res: Response) {
  try {
    const body = req.body as { key?: string; value?: string };
    const key = body?.key ?? 'logo';
    const value = body?.value ?? '';
    await setConfig(key, value);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
