import { describe, expect, it } from 'vitest';
import {
  buildDataBasePorPedidoIdMap,
  dataProducaoCarradaEmFormacaoApartirDe,
  maxDataProducaoPedidosNormais,
  resolverDataBasePedido,
} from '../src/utils/dataBasePedidoFormacao.js';

describe('dataBasePedidoFormacao', () => {
  it('max+30 a partir do max das carradas normais', () => {
    expect(dataProducaoCarradaEmFormacaoApartirDe('2026-09-14')).toBe('2026-10-14');
  });

  it('maxDataProducaoPedidosNormais ignora formação e ordem final', () => {
    const max = maxDataProducaoPedidosNormais([
      { Observacoes: 'ROTA BELEM 06', data_producao: '2026-09-14' },
      { Observacoes: '4-Inserir em Romaneio', romaneio_como_formacao: true, data_producao: '2026-01-01' },
      { Observacoes: 'Carrada constr', data_producao: '2026-12-01' },
      { Observacoes: '5-Requisicao', data_producao: '2026-11-01' },
    ]);
    expect(max).toBe('2026-09-14');
  });

  it('formação usa dataFormacao e nunca previsão ERP', () => {
    expect(
      resolverDataBasePedido(
        {
          Observacoes: '4-Inserir em Romaneio',
          romaneio_como_formacao: true,
          previsao_entrega_atualizada: '2026-07-08',
        },
        '2026-10-14'
      )
    ).toBe('2026-10-14');
  });

  it('formação preferencialmente usa data_producao real', () => {
    expect(
      resolverDataBasePedido(
        {
          Observacoes: 'Carrada constr',
          data_producao: '2026-08-20',
          previsao_entrega_atualizada: '2026-07-08',
        },
        '2026-10-14'
      )
    ).toBe('2026-08-20');
  });

  it('pedido normal: data_producao ?? previsão', () => {
    expect(
      resolverDataBasePedido({
        Observacoes: 'ROTA BELEM 06',
        previsao_entrega_atualizada: '2026-07-23',
      })
    ).toBe('2026-07-23');
    expect(
      resolverDataBasePedido({
        Observacoes: 'ROTA BELEM 06',
        data_producao: '2026-07-20',
        previsao_entrega_atualizada: '2026-07-23',
      })
    ).toBe('2026-07-20');
  });

  it('buildDataBasePorPedidoIdMap aplica overlay e MIN por pd.id', () => {
    const map = buildDataBasePorPedidoIdMap(
      [
        { id: 1, Observacoes: 'ROTA A', data_producao: '2026-09-14' },
        {
          id: 45498,
          Observacoes: '4-Inserir em Romaneio',
          romaneio_como_formacao: true,
          previsao_entrega_atualizada: '2026-07-08',
        },
        {
          id: 45498,
          Observacoes: '4-Inserir em Romaneio',
          romaneio_como_formacao: true,
          previsao_entrega_atualizada: '2026-07-10',
        },
      ],
      (p) => Number((p as { id: number }).id)
    );
    expect(map.get(1)).toBe('2026-09-14');
    expect(map.get(45498)).toBe('2026-10-14');
  });
});
