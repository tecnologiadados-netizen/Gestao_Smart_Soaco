import { describe, expect, it } from 'vitest';
import {
  DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE,
  ehConferenciaNfPcValida,
} from './doubleCheckInConferenciaPeriodo.js';

describe('período válido da conferência NF × PC', () => {
  it('começa no primeiro dia útil após a publicação do fluxo completo', () => {
    expect(DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE.toISOString()).toBe(
      '2026-09-21T03:00:00.000Z'
    );
    expect(ehConferenciaNfPcValida(new Date('2026-09-18T20:14:20.948Z'))).toBe(false);
    expect(ehConferenciaNfPcValida(new Date('2026-09-21T03:00:00.000Z'))).toBe(true);
  });
});
