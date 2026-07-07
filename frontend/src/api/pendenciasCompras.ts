import { apiJson } from './client';

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
  nomeColeta: string;
  destaques: PendenciasComprasDestaques;
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
