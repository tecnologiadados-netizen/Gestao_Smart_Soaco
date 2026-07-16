import type { Request, Response } from 'express';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import {
  getFaltasAlertaEnquadramentos,
  getFaltasAlertaInconsistencias,
  getFaltasAlertaRegras,
  registrarFaltasAlertaAusencia,
  removerFaltasAlertaPorFaltas,
  setFaltasAlertaRegraAtiva,
  updateFaltasAlertaInconsistencia,
} from '../repositories/alertasRepository.js';
import type { AusenciaAtivaRef } from '../lib/faltas-alerta-api.js';
import { s, sendError } from '../utils/rhHelpers.js';

function authCtx(req: Request) {
  const ctx = req.rhAuth!;
  return { actor: ctx.actor, permissions: resolveSessionPermissions(ctx) };
}

export async function getFaltasAlertaRegrasHandler(_req: Request, res: Response) {
  try {
    res.json(await getFaltasAlertaRegras());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function setFaltasAlertaRegraAtivaHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as { regraId?: string; ativa?: boolean };
    const regraId = s(body.regraId);
    if (!regraId) return sendError(res, 'regraId obrigatório.', 400);
    await setFaltasAlertaRegraAtiva(regraId, body.ativa !== false, actor);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getFaltasAlertaEnquadramentosHandler(_req: Request, res: Response) {
  try {
    res.json(await getFaltasAlertaEnquadramentos());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getFaltasAlertaInconsistenciasHandler(req: Request, res: Response) {
  try {
    let faltasAtivas: AusenciaAtivaRef[] = [];
    if (req.method === 'POST') {
      const body = req.body as { faltasAtivas?: AusenciaAtivaRef[] };
      faltasAtivas = Array.isArray(body?.faltasAtivas) ? body.faltasAtivas : [];
    }
    res.json(await getFaltasAlertaInconsistencias(faltasAtivas));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function updateFaltasAlertaInconsistenciaHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as {
      id?: string;
      status?: string;
      resolucaoNotas?: string;
    };
    const id = s(body.id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await updateFaltasAlertaInconsistencia({
      id,
      status: body.status,
      resolucaoNotas: body.resolucaoNotas,
      resolvidoPor: actor,
    });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function registrarFaltasAlertaAusenciaHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    res.json(await registrarFaltasAlertaAusencia({ ...req.body, lancadoPor: actor }));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function removerFaltasAlertaPorFaltasHandler(req: Request, res: Response) {
  try {
    const faltaIds = Array.isArray((req.body as { faltaIds?: string[] }).faltaIds)
      ? ((req.body as { faltaIds: string[] }).faltaIds)
      : [];
    res.json(await removerFaltasAlertaPorFaltas(faltaIds));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
