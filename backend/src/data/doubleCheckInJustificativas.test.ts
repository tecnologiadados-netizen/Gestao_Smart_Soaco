import { describe, expect, it } from 'vitest';
import {
  JUSTIFICATIVA_SEED,
  justificativaAplicavelAoCampo,
  normalizarCamposJustificativa,
} from './doubleCheckInJustificativas.js';

describe('justificativas do Double Check', () => {
  it('deixa Outros por último e disponível em todos os campos', () => {
    const outros = JUSTIFICATIVA_SEED.find((s) => s.codigo === 'outros');
    expect(outros?.sortOrder).toBe(Math.max(...JUSTIFICATIVA_SEED.map((s) => s.sortOrder)));
    expect(justificativaAplicavelAoCampo('outros', 'qtde')).toBe(true);
    expect(justificativaAplicavelAoCampo('outros', 'condicao_pagamento')).toBe(true);
  });

  it('aceita só os campos conhecidos e sem repetir', () => {
    expect(normalizarCamposJustificativa(['qtde', 'qtde', 'frete', 'ipi'])).toEqual(['qtde', 'ipi']);
    expect(normalizarCamposJustificativa('qtde')).toEqual([]);
  });

  it('não oferece motivo de pagamento numa divergência de quantidade', () => {
    expect(justificativaAplicavelAoCampo('condicao_nao_cadastrada', 'qtde')).toBe(false);
    expect(justificativaAplicavelAoCampo('peso_da_peca', 'qtde')).toBe(true);
    expect(justificativaAplicavelAoCampo('entrada_avulsa', 'condicao_pagamento')).toBe(true);
    expect(justificativaAplicavelAoCampo('frete_lancado_na_entrada', 'condicao_pagamento')).toBe(true);
    expect(justificativaAplicavelAoCampo('frete_lancado_na_entrada', 'qtde')).toBe(false);
    expect(justificativaAplicavelAoCampo('ipi_reflexo', 'ipi')).toBe(true);
    expect(justificativaAplicavelAoCampo('ipi_reflexo', 'valor_unitario')).toBe(false);
  });
});
