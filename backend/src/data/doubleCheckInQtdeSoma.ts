/**
 * A mesma linha da NF pode estar ligada a vários itens do pedido quando o item
 * foi pedido em mais de uma solicitação de compra. A quantidade conferida é a
 * soma dessas linhas, não cada uma contra o total da nota.
 */

export type ParteQtdePedido = {
  idItemPedidoCompra: number;
  qtde: number;
};

type LinhaQtdeSomavel = {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idProduto: number | null;
  codigoProduto?: string | null;
  qtdeNF: number;
  qtdePC: number;
  umNF: string | null;
  umPC: string | null;
  divergValorUnitario: boolean;
  divergQtde: boolean;
  divergIpi: boolean;
  divergCondicaoPagamento: boolean;
  temDivergencia: boolean;
  qtdePcSoma?: number | null;
  partesQtdePc?: ParteQtdePedido[] | null;
};

/** Mesma leitura de `valoresIguaisComparativo(..., 4)`. */
function qtdeIgual(a: number, b: number): boolean {
  const f = 10 ** 4;
  const r = (n: number) => (Number.isFinite(n) ? Math.round((n + Number.EPSILON) * f) / f : 0);
  return r(a) === r(b);
}

function unidade(v: string | null | undefined): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function chaveGrupo(linha: LinhaQtdeSomavel): string {
  const produto = linha.idProduto != null ? String(linha.idProduto) : (linha.codigoProduto ?? '');
  return `${linha.idItemDocumentoEstoque}|${produto}`;
}

export function aplicarSomaQtdeMesmoItem<T extends LinhaQtdeSomavel>(linhas: T[]): T[] {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    const chave = chaveGrupo(linha);
    const lista = grupos.get(chave) ?? [];
    lista.push(linha);
    grupos.set(chave, lista);
  }

  const somaPorChave = new Map<string, { soma: number; partes: ParteQtdePedido[] }>();
  for (const [chave, grupo] of grupos) {
    if (grupo.length < 2) continue;
    const base = grupo[0];
    const mesmaNf = grupo.every((linha) => qtdeIgual(linha.qtdeNF, base.qtdeNF));
    const mesmaUm = grupo.every(
      (linha) => unidade(linha.umNF) === unidade(base.umNF) && unidade(linha.umPC) === unidade(base.umPC)
    );
    if (!mesmaNf || !mesmaUm) continue;
    const soma = grupo.reduce((total, linha) => total + linha.qtdePC, 0);
    somaPorChave.set(chave, {
      soma,
      partes: grupo.map((linha) => ({
        idItemPedidoCompra: linha.idItemPedidoCompra,
        qtde: linha.qtdePC,
      })),
    });
  }

  return linhas.map((linha) => {
    const grupo = somaPorChave.get(chaveGrupo(linha));
    if (!grupo) {
      return { ...linha, qtdePcSoma: null, partesQtdePc: null };
    }
    const divergQtde = !qtdeIgual(linha.qtdeNF, grupo.soma);
    return {
      ...linha,
      qtdePcSoma: grupo.soma,
      partesQtdePc: grupo.partes,
      divergQtde,
      temDivergencia:
        linha.divergValorUnitario || divergQtde || linha.divergIpi || linha.divergCondicaoPagamento,
    };
  });
}
