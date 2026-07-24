import { describe, expect, it } from 'vitest';
import {
  arred2,
  primeiroIndiceRuptura,
  normalizarDataIsoCalendario,
  saldosENecessidadesDisponibilidade,
  statusCelulaMaterialDia,
  statusDiaAgregado,
} from '../src/utils/disponibilidadeMateriaisCalendarioDerivados.js';

describe('saldosENecessidadesDisponibilidade', () => {
  it('carry-forward: saldo 100, consumo 60/50/30 → falta no 2º dia', () => {
    const dias = [
      { consumo: 60, entrada: 0 },
      { consumo: 50, entrada: 0 },
      { consumo: 30, entrada: 0 },
    ];
    const { saldosInicio, nAcum } = saldosENecessidadesDisponibilidade(dias, { saldoInicial: 100 });
    expect(saldosInicio).toEqual([100, 40, 0]);
    expect(nAcum[0]).toBe(0);
    expect(nAcum[1]).toBe(10);
    expect(nAcum[2]).toBe(40);
    expect(primeiroIndiceRuptura(nAcum)).toBe(1);
  });

  it('entrada PC no dia cobre consumo sem acumular falta', () => {
    const dias = [
      { consumo: 80, entrada: 50 },
      { consumo: 20, entrada: 0 },
    ];
    const { saldosInicio, nAcum } = saldosENecessidadesDisponibilidade(dias, { saldoInicial: 40 });
    expect(saldosInicio[0]).toBe(40);
    expect(nAcum[0]).toBe(0);
    // dia 0: saldo após = 40-80+50 = 10 → início dia 1 = 10
    expect(saldosInicio[1]).toBe(10);
    expect(nAcum[1]).toBe(10);
  });

  it('saldo inicial negativo vira 0', () => {
    const { saldosInicio } = saldosENecessidadesDisponibilidade([{ consumo: 5, entrada: 0 }], {
      saldoInicial: -10,
    });
    expect(saldosInicio[0]).toBe(0);
  });
});

describe('statusCelulaMaterialDia / statusDiaAgregado', () => {
  it('falta quando nAcum > 0', () => {
    expect(statusCelulaMaterialDia(10, 5, 0, 5)).toBe('falta');
  });

  it('atencao quando saldo < consumo mas saldo+entrada cobrem', () => {
    expect(statusCelulaMaterialDia(100, 40, 60, 0)).toBe('atencao');
  });

  it('ok quando saldo cobre', () => {
    expect(statusCelulaMaterialDia(50, 80, 0, 0)).toBe('ok');
  });

  it('agrega falta > atencao > ok', () => {
    expect(statusDiaAgregado(['ok', 'atencao'])).toBe('atencao');
    expect(statusDiaAgregado(['atencao', 'falta'])).toBe('falta');
    expect(statusDiaAgregado(['ok', 'ok'])).toBe('ok');
  });
});

describe('arred2', () => {
  it('arredonda 2 casas', () => {
    expect(arred2(1.234)).toBe(1.23);
    expect(arred2(1.235)).toBe(1.24);
    expect(arred2(Number.NaN)).toBe(0);
  });
});

describe('normalizarDataIsoCalendario', () => {
  it('aceita ISO e dd/MM/yyyy', () => {
    expect(normalizarDataIsoCalendario('2026-07-27')).toBe('2026-07-27');
    expect(normalizarDataIsoCalendario('27/07/2026')).toBe('2026-07-27');
    expect(normalizarDataIsoCalendario('')).toBe('');
    expect(normalizarDataIsoCalendario('abc')).toBe('');
  });
});
