import { describe, expect, it } from 'vitest';
import {
  SHOP9_DESCRICAO_MAX,
  descricaoPrimeiraReprogramacao,
} from './diarioContasPagarDescricao.js';

const PREFIXO = 'REPROGRAMADO - VENC ORIGINAL 30/09/2026 - ';

describe('descricaoPrimeiraReprogramacao', () => {
  it('mantém o prefixo com 42 caracteres', () => {
    expect(PREFIXO.length).toBe(42);
  });

  it('não reescreve descrição que já foi reprogramada', () => {
    expect(descricaoPrimeiraReprogramacao('REPROGRAMADO - NF 1', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe(
      null,
    );
  });

  it('sem descrição antiga grava só o marcador', () => {
    expect(descricaoPrimeiraReprogramacao('', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe(
      'REPROGRAMADO - VENC ORIGINAL 30/09/2026',
    );
  });

  it('descrição curta permanece inteira no Shop9', () => {
    expect(descricaoPrimeiraReprogramacao('NF 45821 ACME', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe(
      `${PREFIXO}NF 45821 ACME`,
    );
  });

  it('abrevia a descrição antiga e cabe em varchar(80)', () => {
    const texto = descricaoPrimeiraReprogramacao(
      'PAGAMENTO NOTA FISCAL 45821 FORNECEDOR ACME COMERCIO DE MATERIAIS LTDA PARCELA 2',
      '2026-09-30',
      SHOP9_DESCRICAO_MAX,
    );
    expect(texto).not.toBeNull();
    expect(texto!.length).toBeLessThanOrEqual(SHOP9_DESCRICAO_MAX);
    expect(texto!.startsWith(PREFIXO)).toBe(true);
    expect(texto).toContain('PGTO');
    expect(texto).toContain('NF 45821');
    expect(texto).toContain('FORN');
    expect(texto).not.toContain('PAGAMENTO');
    expect(texto).not.toContain('NOTA FISCAL');
  });

  it('Nomus não corta texto longo', () => {
    const longa = 'PAGAMENTO '.repeat(20).trim();
    const texto = descricaoPrimeiraReprogramacao(longa, '2026-09-30');
    expect(texto).toBe(`${PREFIXO}${longa}`);
    expect(texto!.length).toBeGreaterThan(SHOP9_DESCRICAO_MAX);
  });

  it('aceita data vinda do driver como Date UTC', () => {
    const texto = descricaoPrimeiraReprogramacao('BOL 10', new Date('2026-09-30T00:00:00.000Z'), SHOP9_DESCRICAO_MAX);
    expect(texto).toBe('REPROGRAMADO - VENC ORIGINAL 30/09/2026 - BOL 10');
  });
});
