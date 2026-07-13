import type { Request, Response } from 'express';
import { assertOrganicoSectorAllowed } from '../lib/rh-organico-access.js';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import {
  deleteOrganicoDocument,
  downloadOrganicoDocument,
  getOrganicoDocuments,
  uploadOrganicoDocument,
} from '../repositories/documentsRepository.js';
import { s, sendError } from '../utils/rhHelpers.js';

function authCtx(req: Request) {
  const ctx = req.rhAuth!;
  return {
    actor: ctx.actor,
    isMaster: ctx.isMaster,
    permissions: resolveSessionPermissions(ctx),
  };
}

export async function getOrganicoDocumentsHandler(req: Request, res: Response) {
  try {
    const matricula = s(req.query.matricula);
    if (!matricula) return sendError(res, 'matricula obrigatória.', 400);
    res.json(await getOrganicoDocuments(matricula));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function uploadOrganicoDocumentHandler(req: Request, res: Response) {
  try {
    const { actor, isMaster, permissions } = authCtx(req);
    const body = req.body as Record<string, string>;
    const files = req.files as
      | { file?: Express.Multer.File[]; cover?: Express.Multer.File[] }
      | undefined;
    const file = files?.file?.[0];
    const cover = files?.cover?.[0];

    const matricula = s(body.matricula);
    const title = s(body.title);
    const category = s(body.category);
    const folderScope = s(body.folderScope) as 'global' | 'local';
    const folderId = s(body.folderId);

    if (!matricula || !title || !category || !folderId || (folderScope !== 'global' && folderScope !== 'local')) {
      return sendError(res, 'Matrícula, pasta, título e categoria são obrigatórios.', 400);
    }
    if (!file?.buffer?.length) return sendError(res, 'Arquivo inválido.', 400);

    if (!isMaster) {
      const allowed = await assertOrganicoSectorAllowed(false, permissions, {
        matricula,
        nome: s(body.colaboradorNome),
      });
      if (!allowed) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
    }

    const result = await uploadOrganicoDocument({
      matricula,
      title,
      category,
      classification: s(body.classification) || 'confidential',
      folderScope,
      folderId,
      sourceKind: s(body.sourceKind) === 'bulk' ? 'bulk' : 'individual',
      sourcePages: s(body.sourcePages) || null,
      launchSource: s(body.launchSource) || null,
      launchSourceRecordId: s(body.launchSourceRecordId) || null,
      createdBy: actor,
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      cover: cover?.buffer?.length
        ? { buffer: cover.buffer, mimetype: cover.mimetype }
        : null,
    });

    res.json(result);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function downloadOrganicoDocumentHandler(req: Request, res: Response) {
  try {
    const documentId = s(req.query.documentId) || s(req.query.id);
    if (!documentId) return sendError(res, 'documentId obrigatório.', 400);
    const result = await downloadOrganicoDocument(documentId);
    if (!result) return sendError(res, 'Documento não encontrado.', 404);

    res.setHeader('Content-Type', result.row.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.row.originalName)}"`,
    );
    res.send(result.buffer);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function deleteOrganicoDocumentHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const documentId = s((req.body as { documentId?: string; id?: string }).documentId)
      || s((req.body as { id?: string }).id);
    if (!documentId) return sendError(res, 'documentId obrigatório.', 400);
    await deleteOrganicoDocument(documentId, actor);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
