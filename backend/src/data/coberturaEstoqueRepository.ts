/**
 * Painel de Cobertura de Estoque — agrega sobre a mesma consulta da Consulta de Estoque.
 */
import {
  consultarEstoque,
  type FiltrosConsultaEstoque,
} from './consultaEstoqueRepository.js';
import {
  agregarCoberturaEstoque,
  type StatusCoberturaEstoque,
} from './coberturaEstoqueStatus.js';

export async function consultarPainelCoberturaEstoque(params: {
  filtros: FiltrosConsultaEstoque;
  considerarRequisicoes: boolean;
  status?: StatusCoberturaEstoque | null;
  topN?: number;
}): Promise<{
  data: ReturnType<typeof agregarCoberturaEstoque> | null;
  erro?: string;
}> {
  const { data, erro } = await consultarEstoque({
    filtros: params.filtros,
    considerarRequisicoes: params.considerarRequisicoes,
  });

  if (erro) {
    return { data: null, erro };
  }

  return {
    data: agregarCoberturaEstoque(data, {
      topN: params.topN,
      statusFiltro: params.status ?? null,
    }),
  };
}
