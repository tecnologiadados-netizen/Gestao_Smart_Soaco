import { describe, expect, it } from 'vitest';
import { normalizarJustificativaAceite } from './recebimentoConferenciaRepository.js';

describe('normalizarJustificativaAceite', () => {
  it('exige um motivo preenchido', () => {
    expect(normalizarJustificativaAceite('   ').ok).toBe(false);
    expect(normalizarJustificativaAceite(null).ok).toBe(false);
  });

  it('guarda o texto sem espaços nas pontas', () => {
    const r = normalizarJustificativaAceite('  Fornecedor enviou 10 unidades de brinde.  ');
    expect(r).toEqual({ ok: true, texto: 'Fornecedor enviou 10 unidades de brinde.' });
  });

  it('recusa texto acima de 1000 caracteres', () => {
    const r = normalizarJustificativaAceite('a'.repeat(1001));
    expect(r.ok).toBe(false);
  });
});
