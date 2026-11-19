/**
 * Totais líquidos dos vínculos NF × PC do documento.
 * Usados para classificar divergência de unitário quando a forma do desconto
 * difere (ex.: % no pedido vs valor cheio na nota) mas o total fecha.
 */

export type LinhaComTotaisVinculos = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  descontoNF: number;
  descontoPC: number;
  /** Total líquido da linha NF (após desconto do item). */
  valorTotalComDescontoNF: number;
  /** Total líquido da linha PC (após desconto do item). */
  valorTotalComDescontoPC: number;
  /**
   * Desconto do cabeçalho/NFe (totaltributacao.vDesc ou documentoestoque.valorDesconto).
   * Quando maior que a soma dos descontos das linhas, a diferença ainda não foi rateada.
   */
  descontoDocumentoNF?: number;
  totalVinculosNF?: number;
  totalVinculosPC?: number;
  descontoVinculosNF?: number;
  descontoVinculosPC?: number;
};

function dinheiro(n: number | null | undefined): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function totaisVinculosIguais(linha: {
  totalVinculosNF?: number | null;
  totalVinculosPC?: number | null;
}): boolean {
  if (linha.totalVinculosNF == null || linha.totalVinculosPC == null) return false;
  return dinheiro(linha.totalVinculosNF) === dinheiro(linha.totalVinculosPC);
}

/**
 * Agrega totais/descontos únicos por item NF e por item PC e grava em cada linha.
 * Se a NF tem desconto de documento maior que a soma das linhas, abate a diferença
 * do total líquido da NF (desconto cheio ainda não rateado nos itens).
 */
export function aplicarTotaisVinculosDocumento<T extends LinhaComTotaisVinculos>(linhas: T[]): T[] {
  if (linhas.length === 0) return linhas;

  const nfPorItem = new Map<number, { total: number; desconto: number }>();
  const pcPorItem = new Map<number, { total: number; desconto: number }>();
  let descontoDocumentoNF = 0;

  for (const linha of linhas) {
    descontoDocumentoNF = Math.max(descontoDocumentoNF, dinheiro(linha.descontoDocumentoNF));
    nfPorItem.set(linha.idItemDocumentoEstoque, {
      total: dinheiro(linha.valorTotalComDescontoNF),
      desconto: dinheiro(linha.descontoNF),
    });
    pcPorItem.set(linha.idItemPedidoCompra, {
      total: dinheiro(linha.valorTotalComDescontoPC),
      desconto: dinheiro(linha.descontoPC),
    });
  }

  let totalNF = 0;
  let descontoNF = 0;
  for (const item of nfPorItem.values()) {
    totalNF += item.total;
    descontoNF += item.desconto;
  }
  totalNF = dinheiro(totalNF);
  descontoNF = dinheiro(descontoNF);

  let totalPC = 0;
  let descontoPC = 0;
  for (const item of pcPorItem.values()) {
    totalPC += item.total;
    descontoPC += item.desconto;
  }
  totalPC = dinheiro(totalPC);
  descontoPC = dinheiro(descontoPC);

  // Desconto cheio na NF (cabeçalho/NFe) ainda não refletido nas linhas.
  if (descontoDocumentoNF > descontoNF) {
    const extra = dinheiro(descontoDocumentoNF - descontoNF);
    totalNF = dinheiro(totalNF - extra);
    descontoNF = descontoDocumentoNF;
  }

  return linhas.map((linha) => ({
    ...linha,
    totalVinculosNF: totalNF,
    totalVinculosPC: totalPC,
    descontoVinculosNF: descontoNF,
    descontoVinculosPC: descontoPC,
  }));
}
