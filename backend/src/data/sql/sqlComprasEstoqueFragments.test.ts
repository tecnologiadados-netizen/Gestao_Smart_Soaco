import { describe, expect, it } from 'vitest';
import { formatarSetoresVinculoCobertura } from './sqlComprasEstoqueFragments.js';

describe('formatarSetoresVinculoCobertura', () => {
  it('ordena e junta com | só os IDs do painel', () => {
    expect(formatarSetoresVinculoCobertura([20, 2, 19, 2, 99])).toBe('2|19|20');
    expect(formatarSetoresVinculoCobertura([19])).toBe('19');
    expect(formatarSetoresVinculoCobertura([])).toBe('');
  });
});
