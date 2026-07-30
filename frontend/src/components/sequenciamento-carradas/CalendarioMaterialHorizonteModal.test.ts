import { describe, it, expect } from 'vitest';
import {
  compactarLinhasHorizonte,
  montarLinhasHorizonteComCarry,
  type HorizonteLinhaDia,
} from './CalendarioMaterialHorizonteModal';

function dia(
  data: string,
  opts: Partial<Pick<HorizonteLinhaDia, 'consumo' | 'entrada' | 'saldoInicio' | 'saldoProjetado'>> = {}
): HorizonteLinhaDia {
  return {
    tipo: 'dia',
    data,
    consumo: opts.consumo ?? 0,
    entrada: opts.entrada ?? 0,
    saldoInicio: opts.saldoInicio ?? 100,
    saldoProjetado: opts.saldoProjetado ?? 100,
  };
}

describe('compactarLinhasHorizonte', () => {
  it('retorna vazio quando não há consumo nem entrada', () => {
    const linhas = [
      dia('2026-09-01'),
      dia('2026-09-02'),
      dia('2026-09-03'),
    ];
    expect(compactarLinhasHorizonte(linhas)).toEqual([]);
  });

  it('corta antes da 1ª e depois da última data com movimento', () => {
    const linhas = [
      dia('2026-09-01'),
      dia('2026-09-02'),
      dia('2026-09-03', { consumo: 10, saldoInicio: 100, saldoProjetado: 90 }),
      dia('2026-09-04', { saldoInicio: 90, saldoProjetado: 90 }),
      dia('2026-09-05', { entrada: 5, saldoInicio: 90, saldoProjetado: 95 }),
      dia('2026-09-06', { saldoInicio: 95, saldoProjetado: 95 }),
      dia('2026-09-07', { saldoInicio: 95, saldoProjetado: 95 }),
    ];
    const out = compactarLinhasHorizonte(linhas);
    const datas = out.filter((r) => r.tipo === 'dia').map((r) => (r.tipo === 'dia' ? r.data : ''));
    expect(datas[0]).toBe('2026-09-03');
    expect(datas[datas.length - 1]).toBe('2026-09-05');
    expect(datas).not.toContain('2026-09-01');
    expect(datas).not.toContain('2026-09-07');
  });

  it('colapsa gap ≥5 dias em linha ociosa', () => {
    const linhas: HorizonteLinhaDia[] = [];
    // 13/03 com consumo; 14/03–05/04 zeros (23 dias); 06/04 com entrada
    linhas.push(dia('2026-03-13', { consumo: 100, saldoInicio: 200, saldoProjetado: 100 }));
    for (let d = 14; d <= 31; d++) {
      const iso = `2026-03-${String(d).padStart(2, '0')}`;
      linhas.push(dia(iso, { saldoInicio: 100, saldoProjetado: 100 }));
    }
    for (let d = 1; d <= 5; d++) {
      const iso = `2026-04-${String(d).padStart(2, '0')}`;
      linhas.push(dia(iso, { saldoInicio: 100, saldoProjetado: 100 }));
    }
    linhas.push(dia('2026-04-06', { entrada: 50, saldoInicio: 100, saldoProjetado: 150 }));

    const out = compactarLinhasHorizonte(linhas);
    expect(out.some((r) => r.tipo === 'ocioso')).toBe(true);
    const ocioso = out.find((r) => r.tipo === 'ocioso');
    expect(ocioso?.tipo === 'ocioso' && ocioso.de).toBe('2026-03-13');
    expect(ocioso?.tipo === 'ocioso' && ocioso.ate).toBe('2026-04-06');
    expect(out.filter((r) => r.tipo === 'dia')).toHaveLength(2);
  });

  it('mantém dias intermediários quando gap < 5', () => {
    const linhas = [
      dia('2026-07-09', { consumo: 10, saldoInicio: 50, saldoProjetado: 40 }),
      dia('2026-07-10', { saldoInicio: 40, saldoProjetado: 40 }),
      dia('2026-07-11', { saldoInicio: 40, saldoProjetado: 40 }),
      dia('2026-07-12', { saldoInicio: 40, saldoProjetado: 40 }),
      dia('2026-07-13', { consumo: 5, saldoInicio: 40, saldoProjetado: 35 }),
    ];
    const out = compactarLinhasHorizonte(linhas);
    expect(out.every((r) => r.tipo === 'dia')).toBe(true);
    expect(out).toHaveLength(5);
  });
});

describe('montarLinhasHorizonteComCarry', () => {
  it('propaga saldo projetado como início do dia seguinte', () => {
    const out = montarLinhasHorizonteComCarry(
      [
        { data: '2026-10-01', consumo: 10, entrada: 0 },
        { data: '2026-10-02', consumo: 0, entrada: 5 },
      ],
      100
    );
    expect(out[0]).toMatchObject({ saldoInicio: 100, saldoProjetado: 90 });
    expect(out[1]).toMatchObject({ saldoInicio: 90, saldoProjetado: 95 });
  });
});
