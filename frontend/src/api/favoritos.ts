import { apiFetch } from './client';

export interface TelaFavorita {
  id: number;
  nome: string;
  rota: string;
  filtros: Record<string, string>;
  ordem: number;
  padrao: boolean;
  telaLabel: string;
  resumoFiltros: string;
  createdAt: string;
  updatedAt: string;
}

export async function listarFavoritos(rota?: string): Promise<TelaFavorita[]> {
  const q = rota ? `?rota=${encodeURIComponent(rota)}` : '';
  const res = await apiFetch(`/api/me/favoritos${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao listar favoritos.' }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao listar favoritos.');
  }
  const data = (await res.json()) as { favoritos: TelaFavorita[] };
  return data.favoritos ?? [];
}

export async function obterFavorito(id: number): Promise<TelaFavorita> {
  const res = await apiFetch(`/api/me/favoritos/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Favorito não encontrado.' }));
    throw new Error((err as { error?: string }).error ?? 'Favorito não encontrado.');
  }
  return res.json();
}

export async function criarFavorito(payload: {
  nome: string;
  rota: string;
  filtros: Record<string, string>;
}): Promise<TelaFavorita> {
  const res = await apiFetch('/api/me/favoritos', { method: 'POST', body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao salvar favorito.' }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar favorito.');
  }
  return res.json();
}

export async function atualizarFavorito(
  id: number,
  payload: { nome?: string; filtros?: Record<string, string>; ordem?: number }
): Promise<TelaFavorita> {
  const res = await apiFetch(`/api/me/favoritos/${id}`, { method: 'PUT', body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao atualizar favorito.' }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao atualizar favorito.');
  }
  return res.json();
}

export async function definirFavoritoPadrao(id: number): Promise<TelaFavorita> {
  const res = await apiFetch(`/api/me/favoritos/${id}/padrao`, { method: 'PUT', body: {} });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao definir padrão.' }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao definir padrão.');
  }
  return res.json();
}

export async function excluirFavorito(id: number): Promise<void> {
  const res = await apiFetch(`/api/me/favoritos/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao excluir favorito.' }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir favorito.');
  }
}
