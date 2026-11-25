import { describe, expect, it } from 'vitest';
import { documentoConferidoComDivergencia } from './doubleCheckInStatusConferencia';

describe('documentoConferidoComDivergencia', () => {
  it('marca conferido com divergência só quando há divergência real', () => {
    expect(documentoConferidoComDivergencia(true, true)).toBe(true);
  });

  it('trata conferida só com divergência benigna como conferida normal', () => {
    expect(documentoConferidoComDivergencia(true, false)).toBe(false);
  });

  it('não marca pendente, mesmo com divergência real', () => {
    expect(documentoConferidoComDivergencia(false, true)).toBe(false);
  });
});
