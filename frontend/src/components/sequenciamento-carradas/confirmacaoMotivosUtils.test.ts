import { describe, it, expect } from 'vitest';
import {
  agruparAlteradosPorPedido,
  grupoPedidoMotivoConcluido,
  itemMotivoConcluido,
  motivoComumIds,
} from './confirmacaoMotivosUtils';
import type { PedidoAlterado } from './simulacaoCarradas';

function pedido(partial: Partial<PedidoAlterado> & Pick<PedidoAlterado, 'idPedido' | 'pd'>): PedidoAlterado {
  return {
    rota: 'ROTA A',
    cliente: 'Cliente',
    cod: 'PA 1',
    descricao: 'Produto',
    qtdePendenteReal: 1,
    previsaoAnterior: '2026-07-01',
    previsaoNova: '2026-07-20',
    ...partial,
  };
}

describe('agruparAlteradosPorPedido', () => {
  it('agrupa itens do mesmo PD', () => {
    const itens = [
      pedido({ idPedido: 'a', pd: '48418', cod: 'PA 1' }),
      pedido({ idPedido: 'b', pd: 'PD-48418', cod: 'PA 2' }),
      pedido({ idPedido: 'c', pd: '50000', cod: 'PA 3' }),
    ];
    const grupos = agruparAlteradosPorPedido(itens);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.itens.map((i) => i.idPedido)).toEqual(['a', 'b']);
    expect(grupos[1]!.itens.map((i) => i.idPedido)).toEqual(['c']);
  });
});

describe('motivoComumIds', () => {
  it('retorna motivo quando todos coincidem', () => {
    expect(motivoComumIds(['a', 'b'], { a: 'Atraso', b: 'Atraso' })).toBe('Atraso');
  });

  it('retorna vazio quando diverge', () => {
    expect(motivoComumIds(['a', 'b'], { a: 'A', b: 'B' })).toBe('');
  });
});

describe('itemMotivoConcluido', () => {
  it('detecta motivo preenchido', () => {
    expect(itemMotivoConcluido('x', { x: 'Motivo' })).toBe(true);
    expect(itemMotivoConcluido('x', { x: '  ' })).toBe(false);
  });
});

describe('grupoPedidoMotivoConcluido', () => {
  it('verdadeiro quando todos os itens têm motivo', () => {
    const itens = [pedido({ idPedido: 'a', pd: '1' }), pedido({ idPedido: 'b', pd: '1' })];
    expect(grupoPedidoMotivoConcluido(itens, { a: 'M', b: 'M' })).toBe(true);
    expect(grupoPedidoMotivoConcluido(itens, { a: 'M' })).toBe(false);
  });
});
