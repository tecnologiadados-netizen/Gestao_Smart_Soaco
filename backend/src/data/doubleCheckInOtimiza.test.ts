import { describe, expect, it } from 'vitest';
import { numeroSolicitacaoOtimizaValido } from './doubleCheckInOtimiza.js';

describe('número da solicitação no Otimiza', () => {
  it('aceita inteiro positivo', () => {
    expect(numeroSolicitacaoOtimizaValido(1842)).toBe(1842);
    expect(numeroSolicitacaoOtimizaValido(' 90 ')).toBe(90);
  });

  it('recusa vazio, decimal, zero e texto', () => {
    expect(numeroSolicitacaoOtimizaValido('')).toBeNull();
    expect(numeroSolicitacaoOtimizaValido('12.5')).toBeNull();
    expect(numeroSolicitacaoOtimizaValido(0)).toBeNull();
    expect(numeroSolicitacaoOtimizaValido(-3)).toBeNull();
    expect(numeroSolicitacaoOtimizaValido('otimiza')).toBeNull();
  });
});
