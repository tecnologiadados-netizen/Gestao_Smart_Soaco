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
  /** IPI do item. Entra no total a pagar, fora do líquido usado na classificação do unitário. */
  valorIpiNF?: number;
  valorIpiPC?: number;
  /** ICMS-ST + FCP-ST do item. */
  valorStNF?: number;
  valorStPC?: number;
  /** Frete, seguro, outras despesas, II e IPI devolvido do cabeçalho da NF. */
  acrescimosCabecalhoNF?: number;
  /** totaltributacao.vST + vFCPST. Evita perder ST que não veio no item. */
  valorStCabecalhoNF?: number;
  /** Total oficial da NF (totaltributacao.vNF). */
  valorNfOficial?: number;
  /** totaltributacao.vProd — para saber se os vínculos cobrem a nota inteira. */
  valorProdutosNf?: number;
  totalVinculosNF?: number;
  totalVinculosPC?: number;
  /** Valor a pagar: líquido dos produtos + IPI + ST + acréscimos. Na NF coberta, o vNF. */
  totalRealNF?: number;
  totalRealPC?: number;
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
 *
 * totalVinculos* continua sendo o líquido dos produtos (classificação do unitário).
 * totalReal* é o valor a pagar: esse líquido mais IPI, ST e acréscimos.
 * Quando os vínculos cobrem a nota inteira e existe vNF, o total da NF é o oficial.
 */
export function aplicarTotaisVinculosDocumento<T extends LinhaComTotaisVinculos>(linhas: T[]): T[] {
  if (linhas.length === 0) return linhas;

  const nfPorItem = new Map<number, { total: number; desconto: number; ipi: number; st: number }>();
  const pcPorItem = new Map<number, { total: number; desconto: number; ipi: number; st: number }>();
  let descontoDocumentoNF = 0;
  let acrescimosCabecalhoNF = 0;
  let valorStCabecalhoNF = 0;
  let valorNfOficial = 0;
  let valorProdutosNf = 0;

  for (const linha of linhas) {
    descontoDocumentoNF = Math.max(descontoDocumentoNF, dinheiro(linha.descontoDocumentoNF));
    acrescimosCabecalhoNF = Math.max(acrescimosCabecalhoNF, dinheiro(linha.acrescimosCabecalhoNF));
    valorStCabecalhoNF = Math.max(valorStCabecalhoNF, dinheiro(linha.valorStCabecalhoNF));
    valorNfOficial = Math.max(valorNfOficial, dinheiro(linha.valorNfOficial));
    valorProdutosNf = Math.max(valorProdutosNf, dinheiro(linha.valorProdutosNf));
    nfPorItem.set(linha.idItemDocumentoEstoque, {
      total: dinheiro(linha.valorTotalComDescontoNF),
      desconto: dinheiro(linha.descontoNF),
      ipi: dinheiro(linha.valorIpiNF),
      st: dinheiro(linha.valorStNF),
    });
    pcPorItem.set(linha.idItemPedidoCompra, {
      total: dinheiro(linha.valorTotalComDescontoPC),
      desconto: dinheiro(linha.descontoPC),
      ipi: dinheiro(linha.valorIpiPC),
      st: dinheiro(linha.valorStPC),
    });
  }

  let totalNF = 0;
  let descontoNF = 0;
  let ipiNF = 0;
  let stItensNF = 0;
  for (const item of nfPorItem.values()) {
    totalNF += item.total;
    descontoNF += item.desconto;
    ipiNF += item.ipi;
    stItensNF += item.st;
  }
  totalNF = dinheiro(totalNF);
  descontoNF = dinheiro(descontoNF);
  ipiNF = dinheiro(ipiNF);
  stItensNF = dinheiro(stItensNF);

  let totalPC = 0;
  let descontoPC = 0;
  let ipiPC = 0;
  let stPC = 0;
  for (const item of pcPorItem.values()) {
    totalPC += item.total;
    descontoPC += item.desconto;
    ipiPC += item.ipi;
    stPC += item.st;
  }
  totalPC = dinheiro(totalPC);
  descontoPC = dinheiro(descontoPC);
  ipiPC = dinheiro(ipiPC);
  stPC = dinheiro(stPC);

  // Desconto cheio na NF (cabeçalho/NFe) ainda não refletido nas linhas.
  if (descontoDocumentoNF > descontoNF) {
    const extra = dinheiro(descontoDocumentoNF - descontoNF);
    totalNF = dinheiro(totalNF - extra);
    descontoNF = descontoDocumentoNF;
  }

  const liquidoOficial = dinheiro(valorProdutosNf - descontoDocumentoNF);
  const cobreNota =
    valorProdutosNf > 0 && Math.abs(dinheiro(totalNF - liquidoOficial)) <= 0.02;
  const stNF = cobreNota ? Math.max(stItensNF, valorStCabecalhoNF) : stItensNF;
  const totalRealPC = dinheiro(totalPC + ipiPC + stPC);
  const totalRealNF =
    cobreNota && valorNfOficial > 0
      ? valorNfOficial
      : dinheiro(totalNF + ipiNF + stNF + (cobreNota ? acrescimosCabecalhoNF : 0));

  return linhas.map((linha) => ({
    ...linha,
    totalVinculosNF: totalNF,
    totalVinculosPC: totalPC,
    totalRealNF,
    totalRealPC,
    descontoVinculosNF: descontoNF,
    descontoVinculosPC: descontoPC,
  }));
}
