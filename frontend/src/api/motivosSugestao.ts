import { apiFetch, apiJson } from './client';

export interface MotivoSugestao {
  id: number;
  descricao: string;
  abonada: boolean;
  aplicacaoNaoAbonada: 'montagem' | 'producao' | 'ambos' | null;
  createdAt: string;
  updatedAt: string;
}

export type MotivoSugestaoDados = {
  descricao: string;
  abonada: boolean;
  aplicacao_nao_abonada: 'montagem' | 'producao' | 'ambos' | null;
};

export async function listarMotivosSugestao(): Promise<MotivoSugestao[]> {
  return apiJson<MotivoSugestao[]>('/api/motivos-sugestao');
}

export async function criarMotivoSugestao(dados: MotivoSugestaoDados): Promise<MotivoSugestao> {
  const res = await apiFetch('/api/motivos-sugestao', {
    method: 'POST',
    body: { ...dados, descricao: dados.descricao.trim() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao cadastrar motivo');
  }
  return res.json();
}

export async function atualizarMotivoSugestao(
  id: number,
  dados: MotivoSugestaoDados,
  senha: string
): Promise<MotivoSugestao> {
  const res = await apiFetch(`/api/motivos-sugestao/${id}`, {
    method: 'PUT',
    body: { ...dados, descricao: dados.descricao.trim(), senha: senha.trim() },
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
