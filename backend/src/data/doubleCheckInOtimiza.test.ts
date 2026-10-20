import { describe, expect, it } from 'vitest';
import {
  interpretarRespostaStatusOtimiza,
  mensagemBloqueioAceiteOtimiza,
  numeroSolicitacaoOtimizaValido,
} from './doubleCheckInOtimiza.js';

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

describe('status da solicitação no Otimiza', () => {
  it('interpreta concluída, em andamento e inexistente', () => {
    expect(
      interpretarRespostaStatusOtimiza(
        {
          found: true,
          number: 1234,
          status: 'completed',
          isCompleted: true,
          finishedAt: '2026-05-29T14:08:50.06+00:00',
        },
        1234
      )
    ).toMatchObject({ found: true, status: 'completed', isCompleted: true });

    expect(
      interpretarRespostaStatusOtimiza(
        { found: true, number: 7565, status: 'in_progress', isCompleted: false, finishedAt: null },
        7565
      ).isCompleted
    ).toBe(false);

    expect(interpretarRespostaStatusOtimiza({ found: false, number: 1, status: null }, 1)).toMatchObject({
      found: false,
      status: null,
      isCompleted: null,
    });
  });

  it('libera só solicitação encontrada e concluída', () => {
    expect(
      mensagemBloqueioAceiteOtimiza({
        found: true,
        number: 1234,
        status: 'completed',
        isCompleted: true,
        finishedAt: '2026-05-29T14:08:50.06+00:00',
      })
    ).toBeNull();
    expect(
      mensagemBloqueioAceiteOtimiza({
        found: true,
        number: 9,
        status: 'cancelled',
        isCompleted: true,
        finishedAt: '2026-10-01T00:00:00.000Z',
      })
    ).toBeNull();
  });

  it('barra inexistente e em andamento com mensagem clara', () => {
    expect(
      mensagemBloqueioAceiteOtimiza({
        found: false,
        number: 1,
        status: null,
        isCompleted: null,
        finishedAt: null,
      })
    ).toBe('A solicitação 1 não existe no Otimiza.');
    expect(
      mensagemBloqueioAceiteOtimiza({
        found: true,
        number: 7565,
        status: 'in_progress',
        isCompleted: false,
        finishedAt: null,
      })
    ).toBe('A solicitação 7565 do Otimiza ainda está em andamento.');
  });
});
