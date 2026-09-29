import { describe, expect, it } from 'vitest';
import { destinoMesFaltaSeForaDoPadrao, normalizarMesFalta } from './normalizarMesFalta.js';

describe('destinoMesFaltaSeForaDoPadrao', () => {
  it('mantém o padrão já gravado', () => {
    for (const ok of ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']) {
      expect(destinoMesFaltaSeForaDoPadrao(ok)).toBeNull();
    }
  });

  it('converte só mês reconhecido fora do padrão', () => {
    expect(destinoMesFaltaSeForaDoPadrao('ABRIL')).toBe('abr.');
    expect(destinoMesFaltaSeForaDoPadrao('AGOSTO')).toBe('ago.');
    expect(destinoMesFaltaSeForaDoPadrao('DEZEMBRO')).toBe('dez.');
    expect(destinoMesFaltaSeForaDoPadrao('FEVEREIRO')).toBe('fev.');
    expect(destinoMesFaltaSeForaDoPadrao('MARÇO')).toBe('mar.');
    expect(destinoMesFaltaSeForaDoPadrao('Janeiro')).toBe('jan.');
    expect(destinoMesFaltaSeForaDoPadrao('  setembro  ')).toBe('set.');
  });

  it('não mexe em vazio nem em texto que não é mês', () => {
    expect(destinoMesFaltaSeForaDoPadrao(null)).toBeNull();
    expect(destinoMesFaltaSeForaDoPadrao('')).toBeNull();
    expect(destinoMesFaltaSeForaDoPadrao('N/A')).toBeNull();
    expect(destinoMesFaltaSeForaDoPadrao('férias')).toBeNull();
    expect(normalizarMesFalta('N/A')).toBe('N/A');
  });
});
