import { describe, expect, it } from 'vitest';
import {
  aplicarTotaisVinculosDocumento,
  totaisVinculosIguais,
} from './doubleCheckInTotaisVinculos.js';

describe('aplicarTotaisVinculosDocumento', () => {
  it('soma totais únicos por item NF e PC', () => {
    const [a, b] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 0,
        descontoPC: 25.55,
        valorTotalComDescontoNF: 227.5,
        valorTotalComDescontoPC: 201.95,
      },
      {
        idItemDocumentoEstoque: 2,
        idItemPedidoCompra: 11,
        descontoNF: 0,
        descontoPC: 19.11,
        valorTotalComDescontoNF: 169,
        valorTotalComDescontoPC: 149.89,
      },
    ]);
    expect(a.totalVinculosNF).toBe(396.5);
    expect(a.totalVinculosPC).toBe(351.84);
    expect(a.descontoVinculosNF).toBe(0);
    expect(a.descontoVinculosPC).toBe(44.66);
    expect(b.totalVinculosNF).toBe(a.totalVinculosNF);
    expect(totaisVinculosIguais(a)).toBe(false);
  });

  it('abate desconto de documento não rateado nas linhas e iguala totais', () => {
    const [linha] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 0,
        descontoPC: 279.5,
        valorTotalComDescontoNF: 2479.5,
        valorTotalComDescontoPC: 2200,
        descontoDocumentoNF: 279.5,
      },
    ]);
    expect(linha.descontoVinculosNF).toBe(279.5);
    expect(linha.totalVinculosNF).toBe(2200);
    expect(linha.totalVinculosPC).toBe(2200);
    expect(totaisVinculosIguais(linha)).toBe(true);
  });

  it('não conta o mesmo item NF duas vezes quando há vários vínculos de PC', () => {
    const [a] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 10,
        descontoPC: 5,
        valorTotalComDescontoNF: 100,
        valorTotalComDescontoPC: 40,
      },
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 11,
        descontoNF: 10,
        descontoPC: 5,
        valorTotalComDescontoNF: 100,
        valorTotalComDescontoPC: 50,
      },
    ]);
    expect(a.totalVinculosNF).toBe(100);
    expect(a.totalVinculosPC).toBe(90);
    expect(a.descontoVinculosNF).toBe(10);
    expect(a.descontoVinculosPC).toBe(10);
    expect(a.totalRealNF).toBe(100);
    expect(a.totalRealPC).toBe(90);
  });

  it('soma IPI e ST no valor a pagar e usa o vNF quando a nota está coberta', () => {
    const [linha] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 537953,
        idItemPedidoCompra: 53702,
        descontoNF: 0,
        descontoPC: 0,
        valorTotalComDescontoNF: 494,
        valorTotalComDescontoPC: 494,
        valorIpiNF: 16.06,
        valorIpiPC: 16.06,
        valorStNF: 0,
        valorStPC: 0,
        valorNfOficial: 510.06,
        valorProdutosNf: 494,
      },
    ]);
    expect(linha.totalVinculosNF).toBe(494);
    expect(linha.totalVinculosPC).toBe(494);
    expect(totaisVinculosIguais(linha)).toBe(true);
    expect(linha.totalRealNF).toBe(510.06);
    expect(linha.totalRealPC).toBe(510.06);
  });

  it('não usa o vNF da nota inteira quando só parte dos itens está vinculada', () => {
    const [linha] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 0,
        descontoPC: 0,
        valorTotalComDescontoNF: 400,
        valorTotalComDescontoPC: 400,
        valorIpiNF: 10,
        valorIpiPC: 8,
        valorStNF: 2,
        valorStPC: 2,
        acrescimosCabecalhoNF: 30,
        valorNfOficial: 1100,
        valorProdutosNf: 1000,
      },
    ]);
    expect(linha.totalRealNF).toBe(412);
    expect(linha.totalRealPC).toBe(410);
  });

  it('não conta IPI duas vezes no mesmo item e inclui frete quando a nota está coberta sem vNF', () => {
    const [linha] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 0,
        descontoPC: 0,
        valorTotalComDescontoNF: 100,
        valorTotalComDescontoPC: 40,
        valorIpiNF: 5,
        valorIpiPC: 2,
        acrescimosCabecalhoNF: 10,
        valorProdutosNf: 100,
      },
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 11,
        descontoNF: 0,
        descontoPC: 0,
        valorTotalComDescontoNF: 100,
        valorTotalComDescontoPC: 50,
        valorIpiNF: 5,
        valorIpiPC: 3,
        acrescimosCabecalhoNF: 10,
        valorProdutosNf: 100,
      },
    ]);
    expect(linha.totalVinculosNF).toBe(100);
    expect(linha.totalRealNF).toBe(115);
    expect(linha.totalRealPC).toBe(95);
  });

  it('prefere o vNF oficial e não soma o frete de novo', () => {
    const [linha] = aplicarTotaisVinculosDocumento([
      {
        idItemDocumentoEstoque: 1,
        idItemPedidoCompra: 10,
        descontoNF: 0,
        descontoPC: 0,
        valorTotalComDescontoNF: 100,
        valorTotalComDescontoPC: 100,
        valorIpiNF: 5,
        valorIpiPC: 5,
        acrescimosCabecalhoNF: 10,
        valorNfOficial: 115,
        valorProdutosNf: 100,
      },
    ]);
    expect(linha.totalRealNF).toBe(115);
    expect(linha.totalRealPC).toBe(105);
  });
});
