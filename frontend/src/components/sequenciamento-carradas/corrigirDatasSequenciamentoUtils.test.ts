import { describe, it, expect } from 'vitest';
import {
  agruparInvalidasPorPedido,
  chavePedidoGrupo,
  datasComunsDoGrupo,
  itemCampoDiverge,
  valorInputGrupo,
} from './corrigirDatasSequenciamentoUtils';
import type { CarradaDataInvalida } from './simulacaoCarradas';

function item(
  partial: Partial<CarradaDataInvalida> & Pick<CarradaDataInvalida, 'key'>
): CarradaDataInvalida {
  return {
    cod: 'C1',
    carrada: 'Carrada A',
    dataProducao: '',
    dataEntrega: '',
    producaoPassada: false,
    entregaPassada: false,
    previsaoPassada: false,
    ...partial,
  };
}

describe('datasComunsDoGrupo', () => {
  it('retorna a mesma data quando todos os itens coincidem', () => {
    const itens = [
      item({ key: 'a', idPedido: '1', pedido: '48418', dataProducao: '2026-07-15', dataEntrega: '2026-07-20' }),
      item({ key: 'b', idPedido: '2', pedido: '48418', dataProducao: '2026-07-15', dataEntrega: '2026-07-20' }),
    ];
    expect(datasComunsDoGrupo(itens)).toEqual({
      dataProducao: '2026-07-15',
      dataEntrega: '2026-07-20',
    });
  });

  it('retorna misto quando há datas diferentes no grupo', () => {
    const itens = [
      item({ key: 'a', idPedido: '1', pedido: '48418', dataProducao: '2026-07-15', dataEntrega: '2026-07-20' }),
      item({ key: 'b', idPedido: '2', pedido: '48418', dataProducao: '2026-07-16', dataEntrega: '2026-07-20' }),
    ];
    expect(datasComunsDoGrupo(itens)).toEqual({
      dataProducao: 'misto',
      dataEntrega: '2026-07-20',
    });
  });

  it('trata vazio como valor único', () => {
    const itens = [
      item({ key: 'a', idPedido: '1', pedido: '1', dataProducao: '', dataEntrega: '' }),
      item({ key: 'b', idPedido: '2', pedido: '1', dataProducao: '', dataEntrega: '' }),
    ];
    expect(datasComunsDoGrupo(itens)).toEqual({
      dataProducao: '',
      dataEntrega: '',
    });
  });
});

describe('valorInputGrupo', () => {
  it('exibe vazio para misto ou ausência de valor', () => {
    expect(valorInputGrupo('misto')).toBe('');
    expect(valorInputGrupo('')).toBe('');
    expect(valorInputGrupo('2026-07-10')).toBe('2026-07-10');
  });
});

describe('agruparInvalidasPorPedido', () => {
  it('agrupa por PD e preserva ordem de aparição', () => {
    const rows = [
      item({ key: 'p1a', idPedido: '10', pedido: '100', cliente: 'Cliente A' }),
      item({ key: 'p2a', idPedido: '20', pedido: '200', cliente: 'Cliente B' }),
      item({ key: 'p1b', idPedido: '11', pedido: 'PD-100', cliente: 'Cliente A' }),
    ];
    const grupos = agruparInvalidasPorPedido(rows);
    expect(grupos.map((g) => g.pedidoChave)).toEqual(['100', '200']);
    expect(grupos[0]!.itens.map((i) => i.key)).toEqual(['p1a', 'p1b']);
    expect(grupos[1]!.itens.map((i) => i.key)).toEqual(['p2a']);
  });

  it('ignora linhas sem idPedido', () => {
    const rows = [
      item({ key: 'c1', idPedido: undefined, pedido: undefined }),
      item({ key: 'p1', idPedido: '1', pedido: '50' }),
    ];
    expect(agruparInvalidasPorPedido(rows)).toHaveLength(1);
  });
});

describe('chavePedidoGrupo', () => {
  it('normaliza PD numérico', () => {
    expect(chavePedidoGrupo('PD-48418')).toBe('48418');
    expect(chavePedidoGrupo('48418')).toBe('48418');
  });
});

describe('itemCampoDiverge', () => {
  it('detecta item com data diferente dos demais', () => {
    const itens = [
      item({ key: 'a', idPedido: '1', dataProducao: '2026-07-10' }),
      item({ key: 'b', idPedido: '2', dataProducao: '2026-07-11' }),
    ];
    expect(itemCampoDiverge(itens[0]!, itens, 'dataProducao')).toBe(true);
    expect(itemCampoDiverge(itens[1]!, itens, 'dataProducao')).toBe(true);
  });

  it('retorna falso com um único item', () => {
    const itens = [item({ key: 'a', idPedido: '1', dataProducao: '2026-07-10' })];
    expect(itemCampoDiverge(itens[0]!, itens, 'dataProducao')).toBe(false);
  });
});

describe('GrupoInvalidasPorPedido', () => {
  it('inclui datasComuns derivadas dos itens', () => {
    const rows = [
      item({ key: 'a', idPedido: '1', pedido: '10', dataProducao: '2026-07-01', dataEntrega: '2026-07-05' }),
      item({ key: 'b', idPedido: '2', pedido: '10', dataProducao: '2026-07-02', dataEntrega: '2026-07-05' }),
    ];
    const grupo = agruparInvalidasPorPedido(rows)[0]!;
    expect(grupo.datasComuns.dataProducao).toBe('misto');
    expect(grupo.datasComuns.dataEntrega).toBe('2026-07-05');
  });
});
