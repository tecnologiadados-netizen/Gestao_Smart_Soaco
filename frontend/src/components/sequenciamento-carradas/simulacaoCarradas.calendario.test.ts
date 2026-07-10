import { describe, it, expect } from 'vitest';
import { montarEixoDatasCalendario, isFimDeSemana } from './simulacaoCarradas';

describe('montarEixoDatasCalendario', () => {
  it('descarta colunas antes da primeira data com saldo', () => {
    const total = new Map<string, number>([
      ['2026-03-13', 120],
      ['2026-03-14', 0],
      ['2026-04-06', 50],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    const datas = colunas.filter((c) => c.tipo === 'data').map((c) => (c.tipo === 'data' ? c.iso : ''));
    expect(datas[0]).toBe('2026-03-13');
    expect(datas.some((d) => d < '2026-03-13')).toBe(false);
  });

  it('colapsa gap ≥5 dias em coluna ociosa', () => {
    const total = new Map<string, number>([
      ['2026-03-13', 100],
      ['2026-04-06', 50],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    expect(colunas.some((c) => c.tipo === 'ocioso')).toBe(true);
    const ocioso = colunas.find((c) => c.tipo === 'ocioso');
    expect(ocioso?.tipo === 'ocioso' && ocioso.de).toBe('2026-03-13');
  });

  it('inclui fins de semana em intervalo curto', () => {
    const total = new Map<string, number>([
      ['2026-07-09', 10],
      ['2026-07-13', 20],
    ]);
    const colunas = montarEixoDatasCalendario(total);
    const datas = colunas.filter((c) => c.tipo === 'data').map((c) => (c.tipo === 'data' ? c.iso : ''));
    expect(datas).toContain('2026-07-11');
    expect(isFimDeSemana('2026-07-11')).toBe(true);
  });
});
