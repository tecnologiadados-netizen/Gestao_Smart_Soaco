import { describe, expect, it } from 'vitest';
import {
  aliquotaIpiNfMaior,
  aliquotasIpiIguais,
  conferenciaIpiPorDataEntrada,
} from './doubleCheckInIpi.js';

describe('conferência do IPI por data de entrada', () => {
  it('mantém o valor em reais até 14/10/2026', () => {
    expect(conferenciaIpiPorDataEntrada('2026-10-14')).toBe('valor');
    expect(conferenciaIpiPorDataEntrada('2026-09-21')).toBe('valor');
    expect(conferenciaIpiPorDataEntrada(null)).toBe('valor');
  });

  it('passa a comparar o percentual a partir de 15/10/2026', () => {
    expect(conferenciaIpiPorDataEntrada('2026-10-15')).toBe('percentual');
    expect(conferenciaIpiPorDataEntrada('2026-10-16')).toBe('percentual');
  });
});

describe('alíquota de IPI sem tolerância', () => {
  it('aceita só o mesmo percentual', () => {
    expect(aliquotasIpiIguais(0, 0)).toBe(true);
    expect(aliquotasIpiIguais(5, 5)).toBe(true);
    expect(aliquotasIpiIguais(3.25, 3.25)).toBe(true);
    expect(aliquotasIpiIguais(5, 5.00004)).toBe(true);
  });

  it('trata qualquer diferença de alíquota como divergência', () => {
    expect(aliquotasIpiIguais(5, 5.0001)).toBe(false);
    expect(aliquotasIpiIguais(3.25, 5)).toBe(false);
    expect(aliquotasIpiIguais(0, 3.25)).toBe(false);
    expect(aliquotaIpiNfMaior(5, 3.25)).toBe(true);
    expect(aliquotaIpiNfMaior(3.25, 5)).toBe(false);
  });
});
