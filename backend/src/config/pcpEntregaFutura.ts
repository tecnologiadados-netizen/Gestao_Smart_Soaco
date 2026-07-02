/**
 * PCP — tipos de movimentação Nomus que representam entrega futura:
 * documento de saída emitido, mercadoria ainda não saiu do estoque.
 */

export const PCP_TIPOS_MOVIMENTACAO_ENTREGA_FUTURA = [48, 82, 44, 150] as const;

export type PcpTipoMovimentacaoEntregaFutura = (typeof PCP_TIPOS_MOVIMENTACAO_ENTREGA_FUTURA)[number];

/** Metadados Nomus (referência; fonte: tipomovimentacao). */
export const PCP_ENTREGA_FUTURA_TIPOS_NOMUS: ReadonlyArray<{
  id: PcpTipoMovimentacaoEntregaFutura;
  nome: string;
}> = [
  { id: 48, nome: 'Simples faturamento de venda para entrega futura' },
  { id: 82, nome: 'Simples faturamento de venda para entrega futura CF' },
  { id: 44, nome: 'VENDA DE PROD DO ESTABELECIMENTO CONS FINAL/2' },
  { id: 150, nome: 'VENDA DE PRODUÇÃO DO ESTABELECIMENTO CONTRIBUINTE/2' },
];

/** Status NFe aceitos para valor/data base de entrega futura (autorizada/confirmada). */
export const PCP_ENTREGA_FUTURA_NFE_STATUS = [2, 4] as const;

/** Placeholder nos arquivos .sql — substituído em runtime por {@link pcpEntregaFuturaSqlInList}. */
export const PCP_EF_TIPOS_SQL_PLACEHOLDER = '/*PCP_EF_TIPOS_IN*/';

export function pcpEntregaFuturaSqlInList(): string {
  return PCP_TIPOS_MOVIMENTACAO_ENTREGA_FUTURA.join(',');
}

export function pcpEntregaFuturaNfeStatusSqlInList(): string {
  return PCP_ENTREGA_FUTURA_NFE_STATUS.join(',');
}

/** Substitui placeholders de tipos e status NFe nos SQL Nomus do PCP. */
export function aplicarTiposEntregaFuturaSql(sql: string): string {
  return sql
    .replaceAll(PCP_EF_TIPOS_SQL_PLACEHOLDER, pcpEntregaFuturaSqlInList())
    .replaceAll('/*PCP_EF_NFE_STATUS_IN*/', pcpEntregaFuturaNfeStatusSqlInList());
}
