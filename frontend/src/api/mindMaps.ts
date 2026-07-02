import { apiFetch, apiJson } from './client';
import type { MindMapListItem, SavedMap } from '../components/mind-map/types';
import type { MindMapNode } from '../components/mind-map/types';

export async function listMindMaps(): Promise<MindMapListItem[]> {
  const r = await apiJson<{ data: MindMapListItem[] }>('/api/mind-maps');
  return r.data ?? [];
}

export async function getMindMap(id: string): Promise<SavedMap> {
  const r = await apiJson<{ data: SavedMap }>(`/api/mind-maps/${encodeURIComponent(id)}`);
  if (!r.data) throw new Error('Mapa não encontrado.');
  return r.data;
}

export async function createMindMap(payload: {
  name: string;
  mapDescription?: string;
  root: MindMapNode;
  pan: { x: number; y: number };
  zoom: number;
}): Promise<SavedMap> {
  const res = await apiFetch('/api/mind-maps', { method: 'POST', body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar mapa.');
  }
  const r = (await res.json()) as { data: SavedMap };
  return r.data;
}

export async function updateMindMap(
  id: string,
  payload: {
    name: string;
    mapDescription?: string;
    root: MindMapNode;
    pan: { x: number; y: number };
    zoom: number;
  }
): Promise<SavedMap> {
  const res = await apiFetch(`/api/mind-maps/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar mapa.');
  }
  const r = (await res.json()) as { data: SavedMap };
  return r.data;
}

export async function deleteMindMap(id: string): Promise<void> {
  const res = await apiFetch(`/api/mind-maps/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir mapa.');
  }
}

/** Cria cópia de um fluxo existente (novo registro). */
export async function duplicateMindMap(sourceId: string, name?: string): Promise<SavedMap> {
  const orig = await getMindMap(sourceId);
  const base = orig.name.trim() || 'Fluxo';
  const copyName = name?.trim() || `${base} (cópia)`;
  return createMindMap({
    name: copyName,
    mapDescription: orig.mapDescription,
    root: orig.root,
    pan: orig.pan,
    zoom: orig.zoom,
  });
}
