import { describe, expect, it } from 'vitest';
import type { Pedido } from '../../api/pedidos';
import { normalizeRotaNameStr } from '../../utils/rotaCarrada';
import {
  montarItensDataProducaoCalendario,
  rotaPayloadAjusteDoCalendario,
} from './ajustePrevisaoCalendario';

function pedidoBase(overrides: Partial<Pedido> & Record<string, unknown> = {}): Pedido {
  return {
    id_pedido: '100-49498-2956',
    cliente: 'R N MARQUES',
    produto: 'Bandeja',
    qtd: 16,
    previsao_entrega: '2026-07-29',
    previsao_entrega_atualizada: '2026-07-29',
    PD: 'PD 49498',
    Cod: 'PI 2956',
    Observacoes: '3- Entrega em Grande Teresina',
    ...overrides,
  };
}

describe('normalizeRotaNameStr — hífen', () => {
  it('unifica 3-Entrega e 3- Entrega', () => {
    expect(normalizeRotaNameStr('3-Entrega em Grande Teresina')).toBe(
      normalizeRotaNameStr('3- Entrega em Grande Teresina')
    );
    expect(normalizeRotaNameStr('3-Entrega em Grande Teresina')).toBe(
      '3-entrega em grande teresina'
    );
  });
});

describe('montarItensDataProducaoCalendario', () => {
  it('inclui rota Observacoes da linha (caso PD 49498)', () => {
    const itens = montarItensDataProducaoCalendario(pedidoBase(), '2026-07-27');
    expect(itens).toEqual([
      {
        id_pedido: '100-49498-2956',
        data_producao: '2026-07-27',
        rota: '3- Entrega em Grande Teresina',
      },
    ]);
  });

  it('caminho só produção também monta lote com rota (não só sim)', () => {
    const itens = montarItensDataProducaoCalendario(pedidoBase(), '2026-07-27', []);
    expect(itens.length).toBe(1);
    expect(itens[0]?.rota).toBe('3- Entrega em Grande Teresina');
    expect(itens[0]?.data_producao).toBe('2026-07-27');
  });

  it('escopo todos os itens do PD: um registro por item com a respectiva rota', () => {
    const outro = pedidoBase({
      id_pedido: '100-49498-5694',
      Cod: 'PA 5694',
      Observacoes: '3- Entrega em Grande Teresina',
    });
    const itens = montarItensDataProducaoCalendario(pedidoBase(), '2026-07-27', [outro]);
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.id_pedido).sort()).toEqual([
      '100-49498-2956',
      '100-49498-5694',
    ]);
    expect(itens.every((i) => i.rota === '3- Entrega em Grande Teresina')).toBe(true);
  });

  it('sem Observacoes omite rota (ajuste base)', () => {
    const itens = montarItensDataProducaoCalendario(
      pedidoBase({ Observacoes: '', Observações: '', Rota: '', rota: '' }),
      '2026-07-27'
    );
    expect(itens).toEqual([{ id_pedido: '100-49498-2956', data_producao: '2026-07-27' }]);
  });

  it('lote vazio quando data inválida (persistência deve falhar no modal)', () => {
    expect(montarItensDataProducaoCalendario(pedidoBase(), '')).toEqual([]);
    expect(montarItensDataProducaoCalendario(pedidoBase({ id_pedido: '' }), '2026-07-27')).toEqual([]);
  });
});

describe('rotaPayloadAjusteDoCalendario', () => {
  it('modo calendário usa Observacoes da linha quando override não veio preenchido', () => {
    const rota = rotaPayloadAjusteDoCalendario(pedidoBase(), null, { modoCalendario: true });
    expect(rota).toBe('3- Entrega em Grande Teresina');
  });

  it('respeita rotaOverride explícito (somente esta rota)', () => {
    const rota = rotaPayloadAjusteDoCalendario(pedidoBase(), 'ROTA BELEM 07 - LIBERADA', {
      modoCalendario: true,
    });
    expect(rota).toBe('ROTA BELEM 07 - LIBERADA');
  });

  it('forcarBase omite rota (ajuste base — todas as rotas)', () => {
    const rota = rotaPayloadAjusteDoCalendario(pedidoBase(), null, {
      modoCalendario: true,
      forcarBase: true,
    });
    expect(rota).toBeUndefined();
  });
});
