import type { Request, Response } from 'express';
import {
  createRhUserGroup,
  deleteRhUserGroup,
  listRhUserGroups,
  updateRhUserGroup,
} from '../repositories/adminRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

export async function rhUserGroupsListHandler(_req: Request, res: Response) {
  try {
    const groups = await listRhUserGroups();
    res.json({ groups });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function rhUserGroupsCreateHandler(req: Request, res: Response) {
  try {
    const body = req.body as { name?: string; description?: string; permissions?: unknown };
    const group = await createRhUserGroup({
      name: s(body.name),
      description: s(body.description),
      permissions: body.permissions,
    });
    res.json({ group });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('já existe')) return sendError(res, msg, 409);
    sendError(res, msg);
  }
}

export async function rhUserGroupsUpdateHandler(req: Request, res: Response) {
  try {
    const body = req.body as {
      id?: string;
      name?: string;
      description?: string;
      permissions?: unknown;
    };
    const group = await updateRhUserGroup({
      id: s(body.id),
      name: body.name,
      description: body.description,
      permissions: body.permissions,
    });
    res.json({ group });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('não encontrado')) return sendError(res, msg, 404);
    if (msg.includes('já existe')) return sendError(res, msg, 409);
    sendError(res, msg);
  }
}

export async function rhUserGroupsDeleteHandler(req: Request, res: Response) {
  try {
    const id = s((req.body as { id?: string }).id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await deleteRhUserGroup(id);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
