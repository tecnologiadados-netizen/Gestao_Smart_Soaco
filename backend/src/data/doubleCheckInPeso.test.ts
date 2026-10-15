import { describe, expect, it } from 'vitest';
import {
  entradaPorPeso,
  textoContemUnidadePeso,
  textoReaisCasasUtilizadas,
  unidadeEhPeso,
  unitarioExatoNfMaior,
  unitariosExatosIguais,
} from './doubleCheckInPeso.js';

describe('unidade de peso', () => {
  it('reconhece quilograma e as demais unidades de massa', () => {
    expect(unidadeEhPeso('QUILOGRAMA')).toBe(true);
    expect(unidadeEhPeso('kg')).toBe(true);
    expect(unidadeEhPeso('Tonelada')).toBe(true);
    expect(unidadeEhPeso('GRAMA')).toBe(true);
    expect(entradaPorPeso('QUILOGRAMA', 'QUILOGRAMA')).toBe(true);
  });

  it('não trata unidade, metro ou peça como peso', () => {
    expect(unidadeEhPeso('UNIDADE')).toBe(false);
    expect(unidadeEhPeso('UN')).toBe(false);
    expect(unidadeEhPeso('METRO')).toBe(false);
    expect(unidadeEhPeso('PEÇA')).toBe(false);
    expect(entradaPorPeso('UN', 'UN')).toBe(false);
    expect(textoContemUnidadePeso('124,8 QUILOGRAMA')).toBe(true);
    expect(textoContemUnidadePeso('10 UNIDADE')).toBe(false);
  });
});

describe('valor unitário exato no peso', () => {
  it('exige igualdade em todas as casas, sem tolerância de centavos', () => {
    expect(unitariosExatosIguais(8.9, 8.9)).toBe(true);
    expect(unitariosExatosIguais(8.904, 8.901)).toBe(false);
    expect(unitarioExatoNfMaior(8.904, 8.901)).toBe(true);
    expect(unitarioExatoNfMaior(8.901, 8.904)).toBe(false);
  });

  it('mostra no texto completo cada casa além das 4 do card', () => {
    expect(textoReaisCasasUtilizadas(8.9)).toBe('R$ 8,9000');
    expect(textoReaisCasasUtilizadas(8.901234)).toBe('R$ 8,901234');
    expect(textoReaisCasasUtilizadas(1234.5)).toBe('R$ 1.234,5000');
  });
});
