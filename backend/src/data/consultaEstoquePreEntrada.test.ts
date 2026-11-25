import { describe, expect, it } from 'vitest';
import { mapConsultaRow } from './consultaEstoqueRepository.js';

describe('Consulta de Estoque — pré-entrada', () => {
  it('mantém Pedido compra e Pré Entrada em colunas separadas e soma ambos uma vez', () => {
    const row = mapConsultaRow(
      {
        idProduto: 2929,
        codigo: 'MP 2929',
        descricao: 'Produto',
        unidadeMedida: 'UN',
        tipoProduto: 'MP',
        saldo: 17,
        cotacao: 0,
        pedidoCompra: 0,
        preEntrada: 40,
      },
      { empenho: 57, solicitacao: 0 },
    );

    expect(row.pedidoCompra).toBe(0);
    expect(row.preEntrada).toBe(40);
    expect(row.saldoProjetado).toBe(0);
  });

  it('usa zero quando o produto não possui pré-entrada', () => {
    const row = mapConsultaRow({
      idProduto: 1,
      codigo: 'MP 1',
      descricao: 'Produto',
      unidadeMedida: 'UN',
      tipoProduto: 'MP',
      saldo: 10,
      cotacao: 2,
      pedidoCompra: 3,
    });

    expect(row.preEntrada).toBe(0);
    expect(row.saldoProjetado).toBe(15);
  });
});
