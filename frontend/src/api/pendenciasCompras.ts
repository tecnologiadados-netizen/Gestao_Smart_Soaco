import { apiFetch, apiJson } from './client';

import type { EstoqueExibicaoPendencias } from '../utils/pendenciasComprasDestaques';

export type PendenciasComprasDestaques = {
  codigo: 'zerado_com_sc' | 'zerado_com_agpag' | 'necessidade_acima_40d' | null;
  agPag: 'menos_24h' | 'mais_24h' | null;
  pc: 'atrasado' | 'em_dia' | null;
};

export type PendenciasComprasLinha = {
  idProduto: number;
  codigo: string;
  descricao: string;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  solicitacao: number;
  agPag: number;
  pedidoCompra: number;
  estoqueAtual: number;
  /** Regra da coluna Estoque conforme estoque padrão do produto no Nomus. */
  estoqueExibicao: EstoqueExibicaoPendencias;
  nomeColeta: string;
  destaques: PendenciasComprasDestaques;
  /** Grupo de prioridade automática (coleta / necessidade — como na planilha Excel). */
  prioridadeAutomatica: number;
  /** Prioridade fixa manual do usuário (null = ordem automática). */
  prioridadeFixa: number | null;
  /** Posição na ordem automática do Nomus (0-based). */
  indiceOrdemAutomatica: number;
};

export async function listarCompradoresPendencias(): Promise<string[]> {
  const res = await apiJson<{ compradores: string[] }>(
    '/api/compras/rotina/pendencias/opcoes-comprador'
  );
  return res.compradores ?? [];
}

export async function consultarPendenciasCompras(comprador: string): Promise<{
  linhas: PendenciasComprasLinha[];
  total: number;
  error?: string;
}> {
  try {
    const sp = new URLSearchParams({ comprador });
    const res = await apiJson<{ linhas: PendenciasComprasLinha[]; total: number }>(
      `/api/compras/rotina/pendencias/consultar?${sp}`
    );
    return { linhas: res.linhas ?? [], total: res.total ?? 0 };
  } catch (e) {
    return {
      linhas: [],
      total: 0,
      error: e instanceof Error ? e.message : 'Erro ao consultar pendências',
    };
  }
}

export async function salvarPrioridadeFixaPendencias(input: {
  comprador: string;
  idProduto: number;
  prioridade: number;
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/compras/rotina/pendencias/prioridade-fixa', {
      method: 'PUT',
      body: input,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? 'Erro ao salvar prioridade fixa');
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao salvar prioridade fixa' };
  }
}

export async function removerPrioridadeFixaPendencias(input: {
  comprador: string;
  idProduto: number;
}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const sp = new URLSearchParams({
      comprador: input.comprador,
      idProduto: String(input.idProduto),
    });
    const res = await apiFetch(`/api/compras/rotina/pendencias/prioridade-fixa?${sp}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? 'Erro ao remover prioridade fixa');
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao remover prioridade fixa' };
  }
}
