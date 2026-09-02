import { describe, it, expect } from 'vitest';
import {
  agruparAlteradosPorPedido,
  grupoPedidoMotivoConcluido,
  itemMotivoConcluido,
  itemPrevisaoConfiavelEscolhida,
  materializarPrevisaoConfiavelDoSnapshot,
  motivoComumIds,
  observacaoComumIds,
  previsaoConfiavelComumIds,
  previsaoConfiavelEfetiva,
} from './confirmacaoMotivosUtils';
import type { PedidoAlterado } from './simulacaoCarradas';

function pedido(partial: Partial<PedidoAlterado> & Pick<PedidoAlterado, 'idPedido' | 'pd'>): PedidoAlterado {
  return {
    rota: 'ROTA A',
    chaveSim: 'PA 1\x1eROTA A',
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

describe('observacaoComumIds', () => {
  it('retorna observação comum ou vazio se divergir', () => {
    expect(observacaoComumIds(['a', 'b'], { a: 'Obs', b: 'Obs' })).toBe('Obs');
    expect(observacaoComumIds(['a', 'b'], { a: 'Obs', b: 'Outra' })).toBe('');
  });
});

describe('previsaoConfiavel', () => {
  it('trata ausente como null (não escolhido)', () => {
    expect(previsaoConfiavelEfetiva('x', {})).toBe(null);
    expect(previsaoConfiavelEfetiva('x', { x: null })).toBe(null);
    expect(previsaoConfiavelEfetiva('x', { x: false })).toBe(false);
    expect(previsaoConfiavelEfetiva('x', { x: true })).toBe(true);
  });

  it('detecta valor comum ou divergência', () => {
    expect(previsaoConfiavelComumIds(['a', 'b'], {})).toBe(null);
    expect(previsaoConfiavelComumIds(['a', 'b'], { a: false, b: false })).toBe(false);
    expect(previsaoConfiavelComumIds(['a', 'b'], { a: true, b: true })).toBe(true);
    expect(previsaoConfiavelComumIds(['a', 'b'], { a: false })).toBe(null);
    expect(previsaoConfiavelComumIds(['a', 'b'], { a: false, b: true })).toBe(null);
  });

  it('exige escolha explícita Sim/Não', () => {
    expect(itemPrevisaoConfiavelEscolhida('x', {})).toBe(false);
    expect(itemPrevisaoConfiavelEscolhida('x', { x: null })).toBe(false);
    expect(itemPrevisaoConfiavelEscolhida('x', { x: true })).toBe(true);
    expect(itemPrevisaoConfiavelEscolhida('x', { x: false })).toBe(true);
  });
});

describe('materializarPrevisaoConfiavelDoSnapshot', () => {
  it('copia snapshot quando o mapa não tem escolha', () => {
    const out = materializarPrevisaoConfiavelDoSnapshot(
      {},
      [
        { id_pedido: 'a', previsao_atual_confiavel: false },
        { id_pedido: 'b', previsao_atual_confiavel: true },
        { id_pedido: 'c', previsao_atual_confiavel: null },
      ]
    );
    expect(out).toEqual({ a: false, b: true });
  });

  it('não sobrescreve override true/false do rascunho', () => {
    const out = materializarPrevisaoConfiavelDoSnapshot(
      { a: true, b: false },
      [
        { id_pedido: 'a', previsao_atual_confiavel: false },
        { id_pedido: 'b', previsao_atual_confiavel: true },
      ]
    );
    expect(out).toEqual({ a: true, b: false });
  });

  it('preenche id com null no mapa a partir do snapshot', () => {
    const out = materializarPrevisaoConfiavelDoSnapshot(
      { a: null },
      [{ id_pedido: 'a', previsao_atual_confiavel: false }]
    );
    expect(out).toEqual({ a: false });
  });

  it('ignora linhas sem id e aceita idChave', () => {
    const out = materializarPrevisaoConfiavelDoSnapshot(
      {},
      [
        { previsao_atual_confiavel: true },
        { id_pedido: '  ', previsao_atual_confiavel: true },
        { idChave: 'x', previsao_atual_confiavel: false },
      ]
    );
    expect(out).toEqual({ x: false });
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
