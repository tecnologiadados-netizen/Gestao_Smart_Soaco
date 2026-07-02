import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export interface MindMapGraphPayload {
  root: unknown;
  pan?: { x?: number; y?: number };
  zoom?: number;
}

function parseGraphJson(raw: string): MindMapGraphPayload | null {
  try {
    const o = JSON.parse(raw) as MindMapGraphPayload;
    if (!o || typeof o !== 'object' || !o.root) return null;
    return o;
  } catch {
    return null;
  }
}

function rowToListItem(row: {
  uid: string;
  name: string;
  mapDescription: string | null;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.uid,
    name: row.name,
    mapDescription: row.mapDescription ?? undefined,
    criadoPorLogin: row.criadoPorLogin,
    criadoPorNome: row.criadoPorNome ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToSavedMap(row: {
  uid: string;
  name: string;
  mapDescription: string | null;
  graphJson: string;
  updatedAt: Date;
}) {
  const graph = parseGraphJson(row.graphJson);
  if (!graph) return null;
  return {
    id: row.uid,
    name: row.name,
    mapDescription: row.mapDescription ?? undefined,
    root: graph.root,
    pan: {
      x: Number(graph.pan?.x ?? 0),
      y: Number(graph.pan?.y ?? 0),
    },
    zoom: Number(graph.zoom ?? 1),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** GET /api/mind-maps */
export async function listMindMaps(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.mindMapSaved.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        uid: true,
        name: true,
        mapDescription: true,
        criadoPorLogin: true,
        criadoPorNome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ data: rows.map(rowToListItem) });
  } catch (err) {
    console.error('[mindMaps] list:', err);
    res.status(503).json({ error: 'Erro ao listar mapas.' });
  }
}

/** POST /api/mind-maps */
export async function createMindMap(req: Request, res: Response): Promise<void> {
  const login = req.user?.login ?? 'anon';
  const nome = req.user?.nome ?? null;
  const body = (req.body ?? {}) as {
    name?: string;
    mapDescription?: string;
    root?: unknown;
    pan?: { x?: number; y?: number };
    zoom?: number;
  };
  const name = String(body.name ?? 'Novo mapa').trim() || 'Novo mapa';
  if (!body.root) {
    res.status(400).json({ error: 'Informe o nó raiz do mapa.' });
    return;
  }
  const graphJson = JSON.stringify({
    root: body.root,
    pan: body.pan ?? { x: 0, y: 0 },
    zoom: body.zoom ?? 1,
  });
  try {
    const row = await prisma.mindMapSaved.create({
      data: {
        name,
        mapDescription: body.mapDescription?.trim() || null,
        graphJson,
        criadoPorLogin: login,
        criadoPorNome: nome,
        atualizadoPorLogin: login,
      },
    });
    const saved = rowToSavedMap(row);
    if (!saved) {
      res.status(503).json({ error: 'Erro ao serializar mapa.' });
      return;
    }
    res.status(201).json({ data: saved });
  } catch (err) {
    console.error('[mindMaps] create:', err);
    res.status(503).json({ error: 'Erro ao criar mapa.' });
  }
}

/** GET /api/mind-maps/:id */
export async function getMindMap(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    const row = await prisma.mindMapSaved.findUnique({ where: { uid } });
    if (!row) {
      res.status(404).json({ error: 'Mapa não encontrado.' });
      return;
    }
    const saved = rowToSavedMap(row);
    if (!saved) {
      res.status(503).json({ error: 'Dados do mapa inválidos.' });
      return;
    }
    res.json({ data: saved });
  } catch (err) {
    console.error('[mindMaps] get:', err);
    res.status(503).json({ error: 'Erro ao carregar mapa.' });
  }
}

/** PUT /api/mind-maps/:id */
export async function updateMindMap(req: Request, res: Response): Promise<void> {
  const login = req.user?.login ?? 'anon';
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  const body = (req.body ?? {}) as {
    name?: string;
    mapDescription?: string;
    root?: unknown;
    pan?: { x?: number; y?: number };
    zoom?: number;
  };
  if (!body.root) {
    res.status(400).json({ error: 'Informe o nó raiz do mapa.' });
    return;
  }
  const graphJson = JSON.stringify({
    root: body.root,
    pan: body.pan ?? { x: 0, y: 0 },
    zoom: body.zoom ?? 1,
  });
  try {
    const row = await prisma.mindMapSaved.update({
      where: { uid },
      data: {
        name: body.name != null ? String(body.name).trim() || 'Novo mapa' : undefined,
        mapDescription: body.mapDescription !== undefined ? (body.mapDescription?.trim() || null) : undefined,
        graphJson,
        atualizadoPorLogin: login,
      },
    });
    const saved = rowToSavedMap(row);
    if (!saved) {
      res.status(503).json({ error: 'Erro ao serializar mapa.' });
      return;
    }
    res.json({ data: saved });
  } catch {
    res.status(404).json({ error: 'Mapa não encontrado.' });
  }
}

/** DELETE /api/mind-maps/:id */
export async function deleteMindMap(req: Request, res: Response): Promise<void> {
  const uid = String(req.params.id ?? '').trim();
  if (!uid) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }
  try {
    await prisma.mindMapSaved.delete({ where: { uid } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Mapa não encontrado.' });
  }
}
