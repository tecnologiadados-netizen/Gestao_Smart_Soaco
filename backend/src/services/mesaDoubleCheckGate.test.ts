import { describe, expect, it } from 'vitest';
import { conferenciaDoubleCheckLiberadaParaMesa } from './mesaDoubleCheckGate.js';

describe('conferenciaDoubleCheckLiberadaParaMesa', () => {
  it('libera entrada antiga em que a conferência não se aplica', () => {
    expect(
      conferenciaDoubleCheckLiberadaParaMesa({
        regime: 'nao_aplicada',
        possuiConferenciaValida: false,
        pendenciasSemDecisao: 0,
      })
    ).toBe(true);
  });

  it('bloqueia enquanto o Double Check não foi concluído', () => {
    expect(
      conferenciaDoubleCheckLiberadaParaMesa({
        regime: 'completa',
        possuiConferenciaValida: false,
        pendenciasSemDecisao: 0,
      })
    ).toBe(false);
  });

  it('libera conferência concluída com ou sem divergência já decidida', () => {
    expect(
      conferenciaDoubleCheckLiberadaParaMesa({
        regime: 'completa',
        possuiConferenciaValida: true,
        pendenciasSemDecisao: 0,
      })
    ).toBe(true);
  });

  it('bloqueia quando a conferência voltou a ter divergência sem decisão', () => {
    expect(
      conferenciaDoubleCheckLiberadaParaMesa({
        regime: 'completa',
        possuiConferenciaValida: true,
        pendenciasSemDecisao: 2,
      })
    ).toBe(false);
  });

  it('libera a conferência simples assim que o documento foi confirmado', () => {
    expect(
      conferenciaDoubleCheckLiberadaParaMesa({
        regime: 'simples',
        possuiConferenciaValida: true,
        pendenciasSemDecisao: 3,
      })
    ).toBe(true);
  });
});
