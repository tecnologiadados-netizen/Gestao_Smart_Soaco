import type { Request, Response } from 'express';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import { sendError } from '../utils/rhHelpers.js';

export async function rhSessionPermissionsHandler(req: Request, res: Response) {
  try {
    const ctx = req.rhAuth!;
    if (ctx.isMaster) {
      res.json({ master: true });
      return;
    }
    res.json({ permissions: resolveSessionPermissions(ctx) });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
