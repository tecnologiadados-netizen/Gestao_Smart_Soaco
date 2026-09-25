/**
 * Contagem de pendências NF × PC.
 * Cond. pagamento é 1 por documento×PC (cabeçalho), demais campos por vínculo de item.
 */

export type LinhaPendenciaComparativo = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number | null;
  divergValorUnitario: boolean;
  divergQtde: boolean;
  divergIpi: boolean;
  divergCondicaoPagamento: boolean;
};

export type DecisaoPendenciaComparativo = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  campo: string;
};

function chaveItemCampo(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

/** Chave de pendência: pagamento agrupa por PC; demais campos por item. */
export function chavePendenciaComparativo(
  linha: Pick<
    LinhaPendenciaComparativo,
    'idItemDocumentoEstoque' | 'idItemPedidoCompra' | 'idPedidoCompra'
  >,
  campo: string
): string {
  if (campo === 'condicao_pagamento') {
    return `pag:${linha.idPedidoCompra ?? 'x'}`;
  }
  return chaveItemCampo(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo);
}

export function contarPendentesComparativoLogica(
  linhas: LinhaPendenciaComparativo[],
  decisoes: DecisaoPendenciaComparativo[]
): number {
  const linhaPorItem = new Map<string, LinhaPendenciaComparativo>();
  for (const l of linhas) {
    linhaPorItem.set(`${l.idItemDocumentoEstoque}:${l.idItemPedidoCompra}`, l);
  }

  const resolvidas = new Set<string>();
  for (const d of decisoes) {
    const linha = linhaPorItem.get(`${d.idItemDocumentoEstoque}:${d.idItemPedidoCompra}`);
    if (linha) {
      resolvidas.add(chavePendenciaComparativo(linha, d.campo));
    } else {
      resolvidas.add(chaveItemCampo(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo));
    }
  }

  const pendentes = new Set<string>();
  for (const linha of linhas) {
    if (linha.divergValorUnitario) {
      const k = chavePendenciaComparativo(linha, 'valor_unitario');
      if (!resolvidas.has(k)) pendentes.add(k);
    }
    if (linha.divergQtde) {
      const k = chavePendenciaComparativo(linha, 'qtde');
      if (!resolvidas.has(k)) pendentes.add(k);
    }
    if (linha.divergIpi) {
      const k = chavePendenciaComparativo(linha, 'ipi');
      if (!resolvidas.has(k)) pendentes.add(k);
    }
    if (linha.divergCondicaoPagamento) {
      const k = chavePendenciaComparativo(linha, 'condicao_pagamento');
      if (!resolvidas.has(k)) pendentes.add(k);
    }
  }
  return pendentes.size;
}
