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
  });
});
