import type { Request, Response } from 'express';
import { assertOrganicoSectorAllowed } from '../lib/rh-organico-access.js';
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
    const matricula = s(req.query.matricula);
    if (!matricula) return sendError(res, 'matricula obrigatória.', 400);
    const row = await getOrganicoFoto(matricula);
    res.json(row);
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
      fotoBase64?: string;
      mimeType?: string;
    };
    const matricula = s(body.matricula);
    if (!matricula || !s(body.fotoBase64)) {
      return sendError(res, 'Matrícula e foto são obrigatórias.', 400);
    }
    const result = await setOrganicoFoto({
      matricula,
      nome: s(body.colaboradorNome) || matricula,
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
    const { actor } = authCtx(req);
    const body = req.body as {
      matricula?: string;
      parentGlobalId?: string;
      parentLocalId?: string;
      name?: string;
    };
    res.json(
      await createOrganicoArchiveFolder({
        matricula: s(body.matricula) || undefined,
        parentGlobalId: s(body.parentGlobalId) || null,
        parentLocalId: s(body.parentLocalId) || null,
        name: s(body.name),
        createdBy: actor,
      }),
    );
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function renameOrganicoArchiveFolderHandler(req: Request, res: Response) {
  try {
    const body = req.body as { scope?: 'global' | 'local'; id?: string; name?: string };
    if (!body.scope || !s(body.id)) return sendError(res, 'scope e id obrigatórios.', 400);
    await renameOrganicoArchiveFolder({ scope: body.scope, id: s(body.id), name: s(body.name) });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, (e as Error).message);
  }
}

export async function hideOrganicoArchiveFolderHandler(req: Request, res: Response) {
  try {
    const { actor } = authCtx(req);
    const body = req.body as { matricula?: string; globalFolderId?: string };
    const matricula = s(body.matricula);
    const globalFolderId = s(body.globalFolderId);
    if (!matricula || !globalFolderId) return sendError(res, 'matricula e globalFolderId obrigatórios.', 400);
    await hideOrganicoArchiveFolder(matricula, globalFolderId, actor);
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

export async function resolveLaunchDocumentsHandler(_req: Request, res: Response) {
  notImplemented(res, 'resolve-launch-documents');
}
