import { apiFetch, apiJson } from './client';

export interface MotivoSugestao {
  id: number;
  descricao: string;
  createdAt: string;
  updatedAt: string;
}

export async function listarMotivosSugestao(): Promise<MotivoSugestao[]> {
  return apiJson<MotivoSugestao[]>('/api/motivos-sugestao');
}

export async function criarMotivoSugestao(descricao: string): Promise<MotivoSugestao> {
  const res = await apiFetch('/api/motivos-sugestao', {
    method: 'POST',
    body: { descricao: descricao.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao cadastrar motivo');
  }
  return res.json();
}

export async function atualizarMotivoSugestao(
  id: number,
  descricao: string,
  senha: string
): Promise<MotivoSugestao> {
  const res = await apiFetch(`/api/motivos-sugestao/${id}`, {
    method: 'PUT',
    body: { descricao: descricao.trim(), senha: senha.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao editar motivo');
  }
  return res.json();
}

export async function excluirMotivoSugestao(id: number, senha: string): Promise<void> {
  const res = await apiFetch(`/api/motivos-sugestao/${id}`, {
    method: 'DELETE',
    body: { senha: senha.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir motivo');
  }
}
