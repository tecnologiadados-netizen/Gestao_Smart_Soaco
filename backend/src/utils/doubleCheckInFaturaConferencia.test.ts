import { describe, expect, it } from 'vitest';
import { pagamentoXmlPendenteEfetivo } from './doubleCheckInFaturaConferencia';

describe('pagamentoXmlPendenteEfetivo', () => {
  it('não bloqueia quando a condição está desligada e ainda não foi lançada', () => {
    expect(
      pagamentoXmlPendenteEfetivo({
        pagamentoXmlPendente: true,
        criterioCondicaoAtivo: false,
        condicaoJaLancada: false,
      })
    ).toBe(false);
  });

  it('mantém o bloqueio com a condição ativa', () => {
    expect(
      pagamentoXmlPendenteEfetivo({
        pagamentoXmlPendente: true,
        criterioCondicaoAtivo: true,
        condicaoJaLancada: false,
      })
    ).toBe(true);
  });

  it('mantém o bloqueio se a condição já foi lançada neste documento', () => {
    expect(
      pagamentoXmlPendenteEfetivo({
        pagamentoXmlPendente: true,
        criterioCondicaoAtivo: false,
        condicaoJaLancada: true,
      })
    ).toBe(true);
  });

  it('não bloqueia quando a fatura já está resolvida', () => {
    expect(
      pagamentoXmlPendenteEfetivo({
        pagamentoXmlPendente: false,
        criterioCondicaoAtivo: true,
        condicaoJaLancada: false,
      })
    ).toBe(false);
  });
});
