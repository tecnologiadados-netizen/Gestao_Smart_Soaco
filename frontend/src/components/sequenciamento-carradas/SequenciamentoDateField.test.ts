import { describe, expect, it } from 'vitest';
import { parseDataDigitadaToIso } from './SequenciamentoDateField';

describe('parseDataDigitadaToIso', () => {
  it('aceita dd/mm/aaaa', () => {
    expect(parseDataDigitadaToIso('04/09/2025')).toBe('2025-09-04');
  });

  it('aceita 8 dígitos e ISO', () => {
    expect(parseDataDigitadaToIso('04092026')).toBe('2026-09-04');
    expect(parseDataDigitadaToIso('2026-09-04')).toBe('2026-09-04');
  });

  it('rejeita data inexistente', () => {
    expect(parseDataDigitadaToIso('31/02/2026')).toBeNull();
  });
});
