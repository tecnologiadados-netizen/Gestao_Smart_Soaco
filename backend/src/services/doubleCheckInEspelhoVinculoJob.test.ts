import { describe, expect, it } from 'vitest';
import {
  idsSemEspelho,
  ymdInicioJanelaEspelho,
  ymdMenosDias,
} from './doubleCheckInEspelhoVinculoJob.js';

describe('janela do espelho automático', () => {
  it('volta 45 dias a partir de hoje', () => {
    expect(ymdMenosDias('2026-11-26', 45)).toBe('2026-10-12');
    expect(ymdInicioJanelaEspelho('2026-11-26')).toBe('2026-10-12');
  });

  it('não passa do início da conferência NF × PC', () => {
    expect(ymdInicioJanelaEspelho('2026-09-30')).toBe('2026-09-21');
  });

  it('ignora documento que já tem espelho', () => {
    expect(idsSemEspelho([10, 20, 30], [20])).toEqual([10, 30]);
  });
});
