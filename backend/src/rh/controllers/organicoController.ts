import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { assertOrganicoSectorAllowed, buildAllowedOrganicoKeys } from '../lib/rh-organico-access.js';
import { resolveSessionPermissions } from '../middleware/rhAuth.js';
import {
  addOrganicoComentario,
  createOrganicoArchiveFolder,
  deleteOrganicoAlteracaoPendente,
  deleteOrganicoComentario,
  deleteOrganicoFoto,
  deleteOrganicoTrajetoria,
  getOrganicoAlteracoesPendentes,
  getOrganicoComentarios,
  getOrganicoFoto,
  listOrganicoFotosResumo,
  getOrganicoList,
  getOrganicoRepresentantes,
  getOrganicoTrajetoria,
  hideOrganicoArchiveFolder,
  importOrganicoTrajetoria,
  renameOrganicoArchiveFolder,
  resolveOrganicoAlteracaoPendente,
  setOrganicoFoto,
  setOrganicoRepresentante,
  syncOrganicoRepresentantes,
  upsertOrganicoAlteracoesPendentes,
} from '../repositories/organicoRepository.js';
import { replaceOrganicoSafe } from '../repositories/replaceRepository.js';
import { notImplemented, s, sendError } from '../utils/rhHelpers.js';
import { fetchSecullumFuncionarios } from '../services/secullumService.js';
import { fetchNomusRepresentantes } from '../services/nomusRepresentantesService.js';

function authCtx(req: Request) {
  const ctx = req.rhAuth!;
  return {
    actor: ctx.actor,
    isMaster: ctx.isMaster,
    permissions: resolveSessionPermissions(ctx),
  };
}

export async function getOrganico(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const list = await getOrganicoList(isMaster, isMaster ? null : permissions);
    res.json(list);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function replaceOrganico(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as { rows?: unknown[]; allowEmpty?: boolean };
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const result = await replaceOrganicoSafe(rows as never[], actor, body?.allowEmpty === true);
    res.json({ ok: true, inserted: result.inserted, snapshotId: result.snapshotId });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getOrganicoComentariosHandler(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const nome = s(req.query.nome);
    const matricula = s(req.query.matricula);
    const summary = req.query.summary === '1';
    if (!summary && !nome && !matricula) {
      return sendError(res, 'Informe nome ou matrícula do colaborador.', 400);
    }
    const data = await getOrganicoComentarios({
      isMaster,
      permissions: isMaster ? null : permissions,
      nome: nome || undefined,
      matricula: matricula || undefined,
      summary,
    });
    res.json(data);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function addOrganicoComentarioHandler(req: Request, res: Response) {
  try {
    const { actor, isMaster, permissions } = authCtx(req);
    const body = req.body as {
      matricula?: string;
      colaboradorNome?: string;
      comentario?: string;
      tipo?: string;
      categoria?: string;
      tagCode?: string;
      visibility?: string;
      campoAlterado?: string;
      valorAnterior?: string;
      valorAtual?: string;
      entries?: Array<Record<string, unknown>>;
    };

    const colaboradorNome = s(body.colaboradorNome);
    const colaboradorMatricula = s(body.matricula) || null;
    if (!colaboradorNome) return sendError(res, 'Nome do colaborador é obrigatório.', 400);

    const rawEntries =
      Array.isArray(body.entries) && body.entries.length > 0
        ? body.entries
        : [
            {
              comentario: body.comentario,
              tipo: body.tipo,
              categoria: body.categoria,
              tagCode: body.tagCode,
              visibility: body.visibility,
              campoAlterado: body.campoAlterado,
              valorAnterior: body.valorAnterior,
              valorAtual: body.valorAtual,
            },
          ];

    if (!isMaster) {
      const allowed = await assertOrganicoSectorAllowed(false, permissions, {
        matricula: colaboradorMatricula,
        nome: colaboradorNome,
      });
      if (!allowed) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
    }

    const mapped = rawEntries.map((entry) => ({
      comentario: s(entry.comentario),
      tipo: s(entry.tipo) || 'comentario',
      categoria: s(entry.categoria) || 'geral',
      tagCode: s(entry.tagCode) || (s(entry.tipo) === 'log_alteracao' ? '10' : '6'),
      visibility: s(entry.visibility) || (s(entry.tipo) === 'log_alteracao' ? 'public' : 'public'),
      campoAlterado: s(entry.campoAlterado) || null,
      valorAnterior: s(entry.valorAnterior) || null,
      valorAtual: s(entry.valorAtual) || null,
    }));

    const created = await addOrganicoComentario({
      colaboradorNome,
      colaboradorMatricula,
      createdBy: actor,
      entries: mapped,
    });
    res.json(Array.isArray(body.entries) && body.entries.length > 0 ? created : created[0] ?? null);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function deleteOrganicoComentarioHandler(req: Request, res: Response) {
  try {
    const id = s((req.body as { id?: string }).id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await deleteOrganicoComentario(id);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getOrganicoFotoHandler(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const matricula = s(req.query.matricula);
    const nome = s(req.query.nome);
    const summary = req.query.summary === '1';

    if (summary) {
      const list = await listOrganicoFotosResumo({
        isMaster,
        permissions: isMaster ? null : permissions,
      });
      return res.json(list);
    }

    if (!matricula && !nome) {
      return sendError(res, 'Informe a matrícula ou nome do colaborador.', 400);
    }

    const row = await getOrganicoFoto({
      matricula: matricula || undefined,
      nome: nome || undefined,
    });

    if (row && !isMaster) {
      const allowedKeys = await buildAllowedOrganicoKeys(false, permissions);
      if (allowedKeys) {
        const matriculaAtual = s(row.colaboradorMatricula);
        const nomeAtual = s(row.colaboradorNome);
        const sectorOk =
          (matriculaAtual && allowedKeys.matriculas.has(matriculaAtual)) ||
          (nomeAtual && allowedKeys.nomes.has(nomeAtual));
        if (!sectorOk) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
      }
    }

    res.json(row ?? { value: null });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function setOrganicoFotoHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as {
      matricula?: string;
      colaboradorNome?: string;
      nome?: string;
      fotoBase64?: string;
      mimeType?: string;
    };
    const matricula = s(body.matricula);
    if (!matricula || !s(body.fotoBase64)) {
      return sendError(res, 'Matrícula e foto são obrigatórias.', 400);
    }
    const result = await setOrganicoFoto({
      matricula,
      nome: s(body.colaboradorNome) || s(body.nome) || matricula,
      fotoBase64: s(body.fotoBase64),
      mimeType: s(body.mimeType) || null,
      updatedBy: actor,
    });
    res.json(result);
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function deleteOrganicoFotoHandler(req: Request, res: Response) {
  try {
    const matricula = s((req.body as { matricula?: string }).matricula);
    if (!matricula) return sendError(res, 'matricula obrigatória.', 400);
    await deleteOrganicoFoto(matricula);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getOrganicoTrajetoriaHandler(req: Request, res: Response) {
  try {
    const matricula = s(req.query.matricula);
    if (!matricula) return sendError(res, 'matricula obrigatória.', 400);
    res.json(await getOrganicoTrajetoria(matricula));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function importOrganicoTrajetoriaHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const raw = (req.body as { rows?: unknown[] }).rows;
    const rows = Array.isArray(raw)
      ? raw
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            colaboradorMatricula: s(r.colaboradorMatricula),
            colaboradorNome: s(r.colaboradorNome) || undefined,
            dataEvento: s(r.dataEvento),
            tipoEvento: s(r.tipoEvento),
            titulo: s(r.titulo),
            descricao: s(r.descricao),
            motivo: s(r.motivo) || null,
            origemArquivo: s(r.origemArquivo) || null,
            importadoPor: actor,
          }))
          .filter((r) => r.colaboradorMatricula && r.dataEvento && r.tipoEvento)
      : [];
    res.json(await importOrganicoTrajetoria(rows));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function parseOrganicoTrajetoriaPdfHandler(_req: Request, res: Response) {
  notImplemented(res, 'parse-organico-trajetoria-pdf');
}

export async function deleteOrganicoTrajetoriaHandler(req: Request, res: Response) {
  try {
    const id = s((req.body as { id?: string }).id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await deleteOrganicoTrajetoria(id);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function getOrganicoAlteracoesPendentesHandler(req: Request, res: Response) {
  try {
    const setor = s(req.query.setor) || undefined;
    res.json(await getOrganicoAlteracoesPendentes(setor));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function upsertOrganicoAlteracoesPendentesHandler(req: Request, res: Response) {
  try {
    const items = Array.isArray((req.body as { items?: unknown[] }).items)
      ? ((req.body as { items: unknown[] }).items as never[])
      : [];
    res.json({ upserted: await upsertOrganicoAlteracoesPendentes(items) });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function resolveOrganicoAlteracaoPendenteHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const id = s((req.body as { id?: string }).id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await resolveOrganicoAlteracaoPendente(id, actor);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function deleteOrganicoAlteracaoPendenteHandler(req: Request, res: Response) {
  try {
    const id = s((req.body as { id?: string }).id);
    if (!id) return sendError(res, 'id obrigatório.', 400);
    await deleteOrganicoAlteracaoPendente(id);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

/** Lista-base de representantes vinda do Nomus (fonte externa). Frontend: { representantes: [...] }. */
export async function getOrganicoRepresentantesHandler(_req: Request, res: Response) {
  try {
    const representantes = await fetchNomusRepresentantes();
    res.json({ representantes });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

/** Dados salvos (banco local) dos representantes — usados para mesclar com a lista-base do Nomus. */
export async function getOrganicoRepresentantesDadosHandler(_req: Request, res: Response) {
  try {
    res.json({ representantes: await getOrganicoRepresentantes() });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function syncOrganicoRepresentantesHandler(req: Request, res: Response) {
  try {
    const body = req.body as {
      rows?: unknown[];
      representantes?: Array<{ representanteKey?: string; nome?: string; nomeRazaoSocial?: string }>;
    };
    // Frontend envia { representantes: [{ representanteKey, nome, nomeRazaoSocial }] }; aceitamos
    // também o formato legado { rows }. "nome" (fantasia) mapeia para nomeFantasia.
    const rows = Array.isArray(body.representantes)
      ? body.representantes.map((r) => ({
          representanteKey: s(r.representanteKey),
          nomeRazaoSocial: s(r.nomeRazaoSocial),
          nomeFantasia: s(r.nome),
        }))
      : Array.isArray(body.rows)
        ? (body.rows as never[])
        : [];
    res.json(await syncOrganicoRepresentantes(rows));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function setOrganicoRepresentanteHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    res.json(await setOrganicoRepresentante({ ...req.body, updatedBy: actor }));
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function createOrganicoArchiveFolderHandler(req: Request, res: Response) {
  try {
    const { actor, isMaster, permissions } = authCtx(req);
    const body = req.body as {
      matricula?: string;
      colaboradorNome?: string;
      name?: string;
      scope?: 'global' | 'local';
      parentId?: string | null;
      parentScope?: 'global' | 'local' | null;
    };
    const name = s(body.name);
    const scope = body.scope === 'local' ? 'local' : 'global';
    const matricula = s(body.matricula);
    const nome = s(body.colaboradorNome);
    const parentId = s(body.parentId) || null;
    const parentScope =
      body.parentScope === 'local' ? 'local' : body.parentScope === 'global' ? 'global' : null;

    if (!name) return sendError(res, 'Nome da pasta é obrigatório.', 400);
    if (scope === 'local' && !matricula) {
      return sendError(res, 'Matrícula é obrigatória para pasta individual.', 400);
    }

    if (scope === 'local' && !isMaster) {
      const allowed = await assertOrganicoSectorAllowed(false, permissions, { matricula, nome });
      if (!allowed) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
    }

    const created =
      scope === 'global'
        ? await createOrganicoArchiveFolder({
            parentGlobalId: parentScope === 'global' ? parentId : null,
            name,
            createdBy: actor,
          })
        : await createOrganicoArchiveFolder({
            matricula,
            parentGlobalId: parentScope === 'global' ? parentId : null,
            parentLocalId: parentScope === 'local' ? parentId : null,
            name,
            createdBy: actor,
          });

    res.json({ ok: true, id: created.id, scope: created.scope });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function renameOrganicoArchiveFolderHandler(req: Request, res: Response) {
  try {
    const { isMaster, permissions } = authCtx(req);
    const body = req.body as {
      scope?: 'global' | 'local';
      id?: string;
      folderId?: string;
      name?: string;
      matricula?: string;
      colaboradorNome?: string;
    };
    const scope = body.scope;
    const id = s(body.folderId) || s(body.id);
    const name = s(body.name);
    const matricula = s(body.matricula);
    const nome = s(body.colaboradorNome);
    if (!scope || !id) return sendError(res, 'scope e folderId são obrigatórios.', 400);
    if (!name) return sendError(res, 'Nome da pasta é obrigatório.', 400);

    if (scope === 'local' && !isMaster) {
      const allowed = await assertOrganicoSectorAllowed(false, permissions, { matricula, nome });
      if (!allowed) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
    }

    await renameOrganicoArchiveFolder({ scope, id, name });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function hideOrganicoArchiveFolderHandler(req: Request, res: Response) {
  try {
    const { actor, isMaster, permissions } = authCtx(req);
    const body = req.body as {
      matricula?: string;
      folderId?: string;
      globalFolderId?: string;
      scope?: 'global' | 'local';
      globalMode?: 'delete_one' | 'delete_all';
      confirm?: boolean;
    };
    const matricula = s(body.matricula);
    const folderId = s(body.folderId) || s(body.globalFolderId);
    const scope = body.scope === 'local' ? 'local' : 'global';
    if (!matricula || !folderId) return sendError(res, 'Matrícula e pasta são obrigatórios.', 400);
    if (body.confirm !== true) return sendError(res, 'Confirmação explícita é obrigatória.', 400);

    if (!isMaster) {
      const allowed = await assertOrganicoSectorAllowed(false, permissions, { matricula });
      if (!allowed) return sendError(res, 'Sem acesso ao setor deste colaborador.', 403);
    }

    if (scope === 'local') {
      await prisma.rhOrganicoDocuments.updateMany({
        where: { matricula, localFolderId: folderId, status: 'active' },
        data: { status: 'deleted', deletedAt: new Date(), deletedBy: actor },
      });
      await prisma.rhOrganicoArchiveFolderLocal.deleteMany({
        where: { id: folderId, matricula },
      });
      res.json({ ok: true });
      return;
    }

    if (body.globalMode === 'delete_all') {
      return sendError(res, 'Exclusão global para todos ainda não portada no Gestor.', 501);
    }

    await hideOrganicoArchiveFolder(matricula, folderId, actor);
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function secullumFuncionariosHandler(_req: Request, res: Response) {
  try {
    const funcionarios = await fetchSecullumFuncionarios();
    res.json({ funcionarios });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}
