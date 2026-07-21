import { describe, expect, it } from 'vitest';
import {
  normalizeRotaForChave,
  resolverPrevisaoAnteriorNaCadeia,
} from '../src/data/pedidosRepository.js';

function d(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function toYmd(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

describe('normalizeRotaForChave', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizeRotaForChave('ROTA BELÉM ABAETETUBA - LIBERADA')).toBe(
      normalizeRotaForChave('rota belem abaetetuba - liberada')
    );
  });
});

describe('resolverPrevisaoAnteriorNaCadeia — duas carradas no mesmo timestamp', () => {
  /**
   * Cenário do PD 48131 / PA 5430 após sequenciamento:
   * - Override A (ABAETETUBA): 31/07 (antes havia 28/07 na mesma rota)
   * - Override B (BELEM 07): 06/08 (antes havia 03/08 na mesma rota)
   * Ambos no mesmo data_ajuste; lista desc por id.
   */
  const rotaA = 'ROTA BELEM ABAETETUBA - LIBERADA';
  const rotaB = 'ROTA BELEM 07 - LIBERADA';

  const historicoCompleto = [
    { rota: rotaB, previsao_nova: d('2026-08-06') }, // id maior — lote simultâneo
    { rota: rotaA, previsao_nova: d('2026-07-31') },
    { rota: rotaB, previsao_nova: d('2026-08-03') },
    { rota: rotaA, previsao_nova: d('2026-07-28') },
  ];

  it('não cruza previsao_anterior entre rotas distintas (lista completa)', () => {
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(historicoCompleto, 0))).toBe('2026-08-03');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(historicoCompleto, 1))).toBe('2026-07-28');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(historicoCompleto, 2))).toBe(null);
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(historicoCompleto, 3))).toBe(null);
  });

  it('filtro da rota A: só cadeia A (sem override B)', () => {
    const filtradoA = historicoCompleto.filter(
      (h) => !h.rota || normalizeRotaForChave(h.rota) === normalizeRotaForChave(rotaA)
    );
    expect(filtradoA).toHaveLength(2);
    expect(toYmd(filtradoA[0]!.previsao_nova)).toBe('2026-07-31');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(filtradoA, 0))).toBe('2026-07-28');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(filtradoA, 1))).toBe(null);
  });

  it('filtro da rota B: só cadeia B (sem override A)', () => {
    const filtradoB = historicoCompleto.filter(
      (h) => !h.rota || normalizeRotaForChave(h.rota) === normalizeRotaForChave(rotaB)
    );
    expect(filtradoB).toHaveLength(2);
    expect(toYmd(filtradoB[0]!.previsao_nova)).toBe('2026-08-06');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(filtradoB, 0))).toBe('2026-08-03');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(filtradoB, 1))).toBe(null);
  });

  it('override usa base quando não há override anterior da mesma rota', () => {
    const comBase = [
      { rota: rotaB, previsao_nova: d('2026-08-06') },
      { rota: rotaA, previsao_nova: d('2026-07-31') },
      { rota: null, previsao_nova: d('2026-07-20') },
    ];
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(comBase, 0))).toBe('2026-07-20');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(comBase, 1))).toBe('2026-07-20');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(comBase, 2))).toBe(null);
  });

  it('ajuste base ignora overrides de rotas ao buscar anterior', () => {
    const lista = [
      { rota: null, previsao_nova: d('2026-08-01') },
      { rota: rotaA, previsao_nova: d('2026-07-31') },
      { rota: null, previsao_nova: d('2026-07-15') },
    ];
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(lista, 0))).toBe('2026-07-15');
  });

  it('usa fallback quando a cadeia não tem anterior', () => {
    const lista = [{ rota: rotaA, previsao_nova: d('2026-07-31') }];
    const fallback = d('2026-07-10');
    expect(toYmd(resolverPrevisaoAnteriorNaCadeia(lista, 0, fallback))).toBe('2026-07-10');
  });
});
