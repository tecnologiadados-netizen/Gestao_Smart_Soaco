import { apiJson } from './client';

export interface RegistroAlteracao {
  id: number;
  id_pedido: string;
  cliente: string;
  previsao_nova: string;
  motivo: string;
  observacao: string | null;
  usuario: string;
  data_ajuste: string;
}

export interface RelatorioAlteracoesResponse {
  registros: RegistroAlteracao[];
  total: number;
}

export interface FiltrosRelatorioAlteracoes {
  data_ini?: string;
  data_fim?: string;
  id_pedido?: string;
  cliente?: string;
}

export async function getRelatorioAlteracoes(
  filtros: FiltrosRelatorioAlteracoes
): Promise<RelatorioAlteracoesResponse> {
  const params = new URLSearchParams();
  if (filtros.data_ini) params.set('data_ini', filtros.data_ini);
  if (filtros.data_fim) params.set('data_fim', filtros.data_fim);
  if (filtros.id_pedido) params.set('id_pedido', filtros.id_pedido);
  if (filtros.cliente) params.set('cliente', filtros.cliente);
  const qs = params.toString();
  return apiJson<RelatorioAlteracoesResponse>(
    `/api/relatorios/alteracoes${qs ? `?${qs}` : ''}`
  );
}
