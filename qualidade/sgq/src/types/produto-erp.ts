/** Dados do produto retornados pelo ERP (Nomus). */
export interface ProdutoErp {
  codigo: string;
  descricao: string;
  grupoProduto: string;
  tipoProduto: string;
}

/**
 * Campos do RNC preenchidos automaticamente a partir do código do produto.
 * Use esta lista ao montar a query no ERP.
 */
export const CAMPOS_VINCULADOS_CODIGO_PRODUTO = [
  "codigoProduto",
  "produto",
  "grupoProduto",
  "tipoProduto",
] as const;

export type CampoVinculadoCodigoProduto =
  (typeof CAMPOS_VINCULADOS_CODIGO_PRODUTO)[number];

export function produtoErpParaCamposRnc(produto: ProdutoErp): {
  codigoProduto: string;
  produto: string;
  grupoProduto: string;
  tipoProduto: string;
} {
  return {
    codigoProduto: produto.codigo,
    produto: produto.descricao
      ? `${produto.codigo} - ${produto.descricao}`
      : produto.codigo,
    grupoProduto: produto.grupoProduto,
    tipoProduto: produto.tipoProduto,
  };
}

export function produtoErpParaCamposRcc(produto: ProdutoErp): {
  codigoProduto: string;
  produto: string;
  grupoProduto: string;
} {
  const descricao =
    produto.descricao && !produto.descricao.startsWith(produto.codigo)
      ? `${produto.codigo} - ${produto.descricao}`
      : produto.descricao || produto.codigo;

  return {
    codigoProduto: produto.codigo,
    produto: descricao,
    grupoProduto: produto.grupoProduto,
  };
}

/** Extrai código do texto completo (histórico Nomus: "PA 10005 - descrição"). */
export function extrairCodigoProduto(produto: string): string {
  const match = produto.trim().match(/^([A-Z]{2,4}\s+[\dA-Za-z./]+)\s*-/i);
  return match ? match[1].trim().toUpperCase() : "";
}
