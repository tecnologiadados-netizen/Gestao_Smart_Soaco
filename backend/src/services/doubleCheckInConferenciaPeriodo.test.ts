import { describe, expect, it } from 'vitest';
import {
  DOUBLE_CHECKIN_CONFERENCIA_DESDE_YMD,
  DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE,
  ehConferenciaNfPcValida,
  regimeConferenciaPorDataEntrada,
} from './doubleCheckInConferenciaPeriodo.js';

describe('período válido da conferência NF × PC', () => {
  it('começa no primeiro dia útil após a publicação do fluxo completo', () => {
    expect(DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE.toISOString()).toBe(
      '2026-09-21T03:00:00.000Z'
    );
    expect(ehConferenciaNfPcValida(new Date('2026-09-18T20:14:20.948Z'))).toBe(false);
    expect(ehConferenciaNfPcValida(new Date('2026-09-21T03:00:00.000Z'))).toBe(true);
  });

  it('separa entradas não aplicáveis, conferência simples e completa', () => {
    expect(DOUBLE_CHECKIN_CONFERENCIA_DESDE_YMD).toBe('2026-09-01');
    expect(regimeConferenciaPorDataEntrada('2026-08-31')).toBe('nao_aplicada');
    expect(regimeConferenciaPorDataEntrada('2026-09-01')).toBe('simples');
    expect(regimeConferenciaPorDataEntrada('2026-09-20')).toBe('simples');
    expect(regimeConferenciaPorDataEntrada('2026-09-21')).toBe('completa');
  });
});
