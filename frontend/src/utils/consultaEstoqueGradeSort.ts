import type { SortLevel } from '../hooks/useGradeFiltrosExcel';

export const SORT_DEFAULT_CONSULTA_ESTOQUE: SortLevel[] = [{ id: 'descricao', dir: 'asc' }];

const COLUNAS_NUMERICAS = new Set([
  'empenho',
  'saldo',
  'solicitacao',
  'cotacao',
  'pedidoCompra',
  'saldoProjetado',
]);

export function getOrderLabelsForConsultaEstoqueCol(columnId: string): { asc: string; desc: string } {
  if (COLUNAS_NUMERICAS.has(columnId)) {
    return { asc: 'Menor para Maior', desc: 'Maior para Menor' };
  }
  return { asc: 'De A a Z', desc: 'De Z a A' };
}

export function isConsultaEstoqueColNumeric(columnId: string): boolean {
  return COLUNAS_NUMERICAS.has(columnId);
}
