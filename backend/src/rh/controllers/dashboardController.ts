import type { Request, Response } from 'express';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import {
  getCargos,
  getColaboradores,
  getDashboard,
  getRelatorios,
  setCargoFaixa,
} from '../repositories/dashboardRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

function authCtx(req: Request) {
  const ctx = req.rhAuth!;
  return {
    actor: ctx.actor,
    isMaster: ctx.isMaster,
    permissions: resolveSessionPermissions(ctx),
  };
}

export async function getDashboardHandler(_req: Request, res: Response) {
  try {
    res.json(await getDashboard());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getCargosHandler(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const rawAreas = req.query.areas;
    const areas = (Array.isArray(rawAreas) ? rawAreas : rawAreas ? [rawAreas] : [])
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
    res.json(await getCargos(isMaster, permissions, areas));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getColaboradoresHandler(_req: Request, res: Response) {
  try {
    res.json(await getColaboradores());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getRelatoriosHandler(_req: Request, res: Response) {
  try {
    res.json(await getRelatorios());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function setCargoFaixaHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as {
      cargo?: string;
      faixaMin?: number | null;
      faixaMax?: number | null;
    };
    await setCargoFaixa({
      cargo: s(body.cargo),
      faixaMin: body.faixaMin ?? null,
      faixaMax: body.faixaMax ?? null,
      updatedBy: actor,
    });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
