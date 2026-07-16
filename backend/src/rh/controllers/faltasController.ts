import type { Request, Response } from 'express';
import { hasSectorAccess } from '../lib/rh-permissions.js';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import {
  getFaltasAtestados,
  getFaltasCadastros,
  getPontualidadePonto,
  getSancoesDisciplinares,
  replaceFaltasAtestadosWithSectorMerge,
  replaceFaltasCadastrosSafe,
  replacePontualidadePontoSafe,
  replaceSancoes,
} from '../repositories/faltasRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

function authCtx(req: Request) {
  const ctx = req.rhAuth!;
  return {
    actor: ctx.actor,
    isMaster: ctx.isMaster,
    permissions: resolveSessionPermissions(ctx),
  };
}

export async function getFaltasAtestadosHandler(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const data = await getFaltasAtestados({
      isMaster,
      permissions,
      distinctMonths: req.query.distinctMonths === '1',
      months: s(req.query.months) || undefined,
      omitMonths: s(req.query.omitMonths) || undefined,
      matricula: s(req.query.matricula) || undefined,
      desde: s(req.query.desde) || undefined,
      ate: s(req.query.ate) || undefined,
    });
    res.json(data);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function replaceFaltasAtestadosHandler(req: Request, res: Response) {
  try {
    const { actor, isMaster, permissions } = authCtx(req);
    const body = req.body as { rows?: unknown[]; allowEmpty?: boolean };
    const rows = Array.isArray(body?.rows) ? (body.rows as never[]) : [];
    const allowEmpty = body?.allowEmpty === true;

    if (!isMaster && permissions) {
      for (const row of rows as Array<{ setor?: string }>) {
        if (!hasSectorAccess(permissions, row.setor)) {
          return sendError(res, 'Sem permissão para gravar ausência em um ou mais setores informados.', 403);
        }
      }
    }

    const result = await replaceFaltasAtestadosWithSectorMerge({
      rows,
      allowEmpty,
      actor,
      isMaster,
      permissions: isMaster ? null : permissions,
    });
    res.json({ ok: true, inserted: result.inserted, snapshotId: result.snapshotId });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getSancoesDisciplinaresHandler(req: Request, res: Response) {
  try {
    const data = await getSancoesDisciplinares({
      distinctMonths: req.query.distinctMonths === '1',
      months: s(req.query.months) || undefined,
      omitMonths: s(req.query.omitMonths) || undefined,
    });
    res.json(data);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function replaceSancoesDisciplinaresHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as { rows?: unknown[]; allowEmpty?: boolean };
    const rows = Array.isArray(body?.rows) ? (body.rows as never[]) : [];
    const result = await replaceSancoes(rows, actor, body?.allowEmpty === true);
    res.json({ ok: true, inserted: result.inserted, snapshotId: result.snapshotId });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getFaltasCadastrosHandler(_req: Request, res: Response) {
  try {
    res.json(await getFaltasCadastros());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function replaceFaltasCadastrosHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as Record<string, unknown>;
    const result = await replaceFaltasCadastrosSafe({
      periodos: Array.isArray(body.periodos) ? (body.periodos as string[]) : [],
      tipos: Array.isArray(body.tipos) ? (body.tipos as string[]) : [],
      cids: Array.isArray(body.cids) ? (body.cids as string[]) : [],
      tiposRegras: Array.isArray(body.tiposRegras) ? (body.tiposRegras as never[]) : [],
      tiposSancoes: Array.isArray(body.tiposSancoes) ? (body.tiposSancoes as string[]) : [],
      categoriasDocumentos: Array.isArray(body.categoriasDocumentos)
        ? (body.categoriasDocumentos as string[])
        : [],
      replaceTiposSancoes: Object.prototype.hasOwnProperty.call(body, 'tiposSancoes'),
      replaceCategoriasDocumentos: Object.prototype.hasOwnProperty.call(body, 'categoriasDocumentos'),
      actor,
      allowEmpty: body.allowEmpty === true,
    });
    res.json({ ok: true, inserted: result.inserted, snapshotId: result.snapshotId });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getPontualidadePontoHandler(_req: Request, res: Response) {
  try {
    res.json(await getPontualidadePonto());
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function replacePontualidadePontoHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as {
      rows?: unknown[];
      dateRangeStart?: string;
      dateRangeEnd?: string;
      allowEmpty?: boolean;
    };
    const result = await replacePontualidadePontoSafe({
      rows: Array.isArray(body.rows) ? body.rows : [],
      dateRangeStart: body.dateRangeStart,
      dateRangeEnd: body.dateRangeEnd,
      actor,
      allowEmpty: body.allowEmpty === true,
    });
    res.json({ ok: true, count: result.count, snapshotId: result.snapshotId });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
