import { aplicarSomaQtdeMesmoItem } from './doubleCheckInQtdeSoma.js';

function linha(parcial: {
  idItemDocumentoEstoque: number;
  idItemPedidoCompra: number;
  qtdeNF: number;
  qtdePC: number;
  idProduto?: number | null;
}) {
  return {
    idItemDocumentoEstoque: parcial.idItemDocumentoEstoque,
    idItemPedidoCompra: parcial.idItemPedidoCompra,
    idProduto: parcial.idProduto ?? 5626,
    qtdeNF: parcial.qtdeNF,
    qtdePC: parcial.qtdePC,
    umNF: 'QUILOGRAMA',
    umPC: 'QUILOGRAMA',
    divergValorUnitario: false,
    divergQtde: parcial.qtdeNF !== parcial.qtdePC,
    divergIpi: false,
    divergCondicaoPagamento: false,
    temDivergencia: parcial.qtdeNF !== parcial.qtdePC,
  };
}

describe('soma da quantidade do mesmo item da NF', () => {
  it('fecha 633,93 kg com as duas linhas do pedido e tira a divergência', () => {
    const [a, b] = aplicarSomaQtdeMesmoItem([
      linha({ idItemDocumentoEstoque: 533856, idItemPedidoCompra: 53095, qtdeNF: 633.93, qtdePC: 480.25 }),
      linha({ idItemDocumentoEstoque: 533856, idItemPedidoCompra: 53127, qtdeNF: 633.93, qtdePC: 153.68 }),
    ]);
    expect(a.divergQtde).toBe(false);
    expect(b.divergQtde).toBe(false);
    expect(a.temDivergencia).toBe(false);
    expect(a.qtdePcSoma).toBeCloseTo(633.93, 4);
    expect(a.partesQtdePc).toEqual([
      { idItemPedidoCompra: 53095, qtde: 480.25 },
      { idItemPedidoCompra: 53127, qtde: 153.68 },
    ]);
  });

  it('mantém divergência quando a soma não fecha com a nota', () => {
    const [a] = aplicarSomaQtdeMesmoItem([
      linha({ idItemDocumentoEstoque: 1, idItemPedidoCompra: 10, qtdeNF: 700, qtdePC: 480.25 }),
      linha({ idItemDocumentoEstoque: 1, idItemPedidoCompra: 11, qtdeNF: 700, qtdePC: 153.68 }),
    ]);
    expect(a.divergQtde).toBe(true);
    expect(a.qtdePcSoma).toBeCloseTo(633.93, 4);
  });

  it('não soma linhas de notas ou produtos diferentes', () => {
    const linhas = aplicarSomaQtdeMesmoItem([
      linha({ idItemDocumentoEstoque: 1, idItemPedidoCompra: 10, qtdeNF: 10, qtdePC: 10 }),
      linha({
        idItemDocumentoEstoque: 2,
        idItemPedidoCompra: 11,
        qtdeNF: 5,
        qtdePC: 4,
        idProduto: 99,
      }),
    ]);
    expect(linhas[0].qtdePcSoma).toBeNull();
    expect(linhas[1].divergQtde).toBe(true);
  });
});
