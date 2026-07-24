import { describe, expect, it } from 'vitest';
import {
  classificarInserirRomaneioPorValor,
  isInserirEmRomaneioCategoria,
} from '../src/data/regrasDataEntregaRepository.js';
import { DEFAULT_REGRA_DATA_ENTREGA } from '../src/config/regrasDataEntrega.js';

describe('Inserir em Romaneio — classificação por valor', () => {
  it('detecta categoria Inserir em Romaneio', () => {
    expect(isInserirEmRomaneioCategoria('Inserir em Romaneio')).toBe(true);
    expect(isInserirEmRomaneioCategoria('4-Inserir em Romaneio')).toBe(true);
    expect(isInserirEmRomaneioCategoria('Carradas')).toBe(false);
  });

  it('valor abaixo do corte → formacao', () => {
    expect(classificarInserirRomaneioPorValor(5000, DEFAULT_REGRA_DATA_ENTREGA)).toBe('formacao');
    expect(classificarInserirRomaneioPorValor(29999.99, null)).toBe('formacao');
  });

  it('valor ≥ corte → regra_acima_corte', () => {
    expect(classificarInserirRomaneioPorValor(30000, DEFAULT_REGRA_DATA_ENTREGA)).toBe(
      'regra_acima_corte'
    );
    expect(classificarInserirRomaneioPorValor(50000, null)).toBe('regra_acima_corte');
  });
});
