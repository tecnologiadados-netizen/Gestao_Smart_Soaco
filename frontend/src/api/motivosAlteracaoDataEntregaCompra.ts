import { apiFetch, apiJson } from './client';

export interface MotivoAlteracaoDataEntregaCompra {
  id: number;
  descricao: string;
  createdAt: string;
  updatedAt: string;
}

export async function listarMotivosAlteracaoDataEntregaCompra(): Promise<MotivoAlteracaoDataEntregaCompra[]> {
  return apiJson<MotivoAlteracaoDataEntregaCompra[]>('/api/integracao/motivos-alteracao-data-entrega-compra');
}

export async function criarMotivoAlteracaoDataEntregaCompra(descricao: string): Promise<MotivoAlteracaoDataEntregaCompra> {
  const res = await apiFetch('/api/integracao/motivos-alteracao-data-entrega-compra', {
    method: 'POST',
    body: { descricao: descricao.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao cadastrar motivo');
  }
  return res.json();
}

export async function atualizarMotivoAlteracaoDataEntregaCompra(
  id: number,
  descricao: string,
  senha: string
): Promise<MotivoAlteracaoDataEntregaCompra> {
  const res = await apiFetch(`/api/integracao/motivos-alteracao-data-entrega-compra/${id}`, {
    method: 'PUT',
    body: { descricao: descricao.trim(), senha: senha.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao editar motivo');
  }
  return res.json();
}

export async function excluirMotivoAlteracaoDataEntregaCompra(id: number, senha: string): Promise<void> {
  const res = await apiFetch(`/api/integracao/motivos-alteracao-data-entrega-compra/${id}`, {
    method: 'DELETE',
    body: { senha: senha.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir motivo');
  }
}
