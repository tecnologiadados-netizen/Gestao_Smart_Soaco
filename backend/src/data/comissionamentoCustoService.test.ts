import { describe, expect, it } from 'vitest';
import { periodoToYm } from './comissionamentoCustoService.js';

describe('periodoToYm', () => {
  it('extrai YYYY-MM de Date retornado pelo mysql2', () => {
    expect(periodoToYm(new Date(2025, 7, 1))).toBe('2025-08');
  });

  it('aceita string ISO YYYY-MM-DD', () => {
    expect(periodoToYm('2025-08-01')).toBe('2025-08');
  });

  it('aceita string YYYY-MM', () => {
    expect(periodoToYm('2024-12')).toBe('2024-12');
  });

  it('rejeita Date inválido e strings não parseáveis', () => {
    expect(periodoToYm(new Date('invalid'))).toBe('');
    expect(periodoToYm('Fri Aug 01')).toBe('');
    expect(periodoToYm(null)).toBe('');
  });
});
