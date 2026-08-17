import { describe, expect, it } from 'vitest';
import {
  agregarCoberturaEstoque,
  classificarCoberturaEstoque,
} from './coberturaEstoqueStatus.js';
import type { ConsultaEstoqueRow } from './consultaEstoqueRepository.js';

describe('classificarCoberturaEstoque', () => {
  it('classifica ruptura e zerado pelo saldo projetado', () => {
    expect(classificarCoberturaEstoque({ saldo: 1, empenho: 5, saldoProjetado: -2 })).toBe(
      'ruptura_projetada'
    );
    expect(classificarCoberturaEstoque({ saldo: 0, empenho: 0, saldoProjetado: 0 })).toBe(
      'zerado_projetado'
    );
  });

  it('classifica frágil, nivelado e excesso', () => {
    expect(classificarCoberturaEstoque({ saldo: 2, empenho: 10, saldoProjetado: 5 })).toBe(
      'cobertura_fragil'
    );
    expect(classificarCoberturaEstoque({ saldo: 10, empenho: 5, saldoProjetado: 8 })).toBe(
      'nivelado'
    );
    expect(classificarCoberturaEstoque({ saldo: 50, empenho: 0, saldoProjetado: 50 })).toBe(
      'excesso_parado'
    );
    expect(classificarCoberturaEstoque({ saldo: 40, empenho: 10, saldoProjetado: 40 })).toBe(
      'excesso_parado'
    );
  });
});

function row(
  partial: Partial<ConsultaEstoqueRow> &
    Pick<ConsultaEstoqueRow, 'codigo' | 'saldo' | 'empenho' | 'saldoProjetado'>
): ConsultaEstoqueRow {
  return {
    idProduto: partial.idProduto ?? Math.abs(partial.codigo.length * 17 + Math.floor(partial.saldo)),
    codigo: partial.codigo,
    descricao: partial.descricao ?? partial.codigo,
    unidadeMedida: 'UN',
    tipoProduto: partial.tipoProduto ?? 'MP',
    saldo: partial.saldo,
    empenho: partial.empenho,
    solicitacao: partial.solicitacao ?? 0,
    cotacao: partial.cotacao ?? 0,
    pedidoCompra: partial.pedidoCompra ?? 0,
    saldoProjetado: partial.saldoProjetado,
  };
}

describe('agregarCoberturaEstoque', () => {
  it('totais batem com a soma dos itens e a régua cobre todos', () => {
    const rows: ConsultaEstoqueRow[] = [
      row({ codigo: 'A', saldo: 1, empenho: 5, saldoProjetado: -2, tipoProduto: 'MP' }),
      row({ codigo: 'B', saldo: 0, empenho: 0, saldoProjetado: 0, tipoProduto: 'PA' }),
      row({ codigo: 'C', saldo: 2, empenho: 10, saldoProjetado: 5, tipoProduto: 'MP' }),
      row({ codigo: 'D', saldo: 10, empenho: 5, saldoProjetado: 8, tipoProduto: 'PA' }),
      row({ codigo: 'E', saldo: 50, empenho: 0, saldoProjetado: 50, tipoProduto: 'MP' }),
    ];
    const agg = agregarCoberturaEstoque(rows);
    expect(agg.totalItens).toBe(5);
    expect(agg.totais.reduce((s, t) => s + t.itens, 0)).toBe(5);
    expect(agg.itens).toHaveLength(5);
    for (const item of agg.itens) {
      expect(item.status).toBe(
        classificarCoberturaEstoque({
          saldo: item.saldo,
          empenho: item.empenho,
          saldoProjetado: item.saldoProjetado,
        })
      );
    }
    const somaSaldo = Math.round(rows.reduce((s, r) => s + r.saldo, 0) * 100) / 100;
    expect(agg.totais.reduce((s, t) => s + t.saldo, 0)).toBeCloseTo(somaSaldo, 5);
  });
});
