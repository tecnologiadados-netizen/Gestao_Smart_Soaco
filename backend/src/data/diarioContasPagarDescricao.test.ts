import { describe, expect, it } from 'vitest';
import {
  SHOP9_DESCRICAO_MAX,
  descricaoPrimeiraReprogramacao,
} from './diarioContasPagarDescricao.js';

const PREFIXO_NOMUS = 'REPROGRAMADO - VENC ORIGINAL 30/09/2026 - ';
const PREFIXO_SHOP9 = 'REP 30/09 ';

describe('descricaoPrimeiraReprogramacao', () => {
  it('mantém o prefixo longo do Nomus com 42 caracteres', () => {
    expect(PREFIXO_NOMUS.length).toBe(42);
  });

  it('usa o marcador curto do Shop9 para caber em varchar(80)', () => {
    expect(PREFIXO_SHOP9.length).toBe(10);
  });

  it('não reescreve descrição que já foi reprogramada', () => {
    expect(descricaoPrimeiraReprogramacao('REPROGRAMADO - NF 1', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe(
      null,
    );
    expect(descricaoPrimeiraReprogramacao('REP 05/10 -PLANO ASSISTENCIA', '2026-10-06', SHOP9_DESCRICAO_MAX)).toBe(
      null,
    );
    expect(descricaoPrimeiraReprogramacao('REP 08/08 CONTRATO 721', '2026-10-06')).toBe(null);
  });

  it('sem descrição antiga grava só o marcador curto no Shop9', () => {
    expect(descricaoPrimeiraReprogramacao('', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe('REP 30/09');
  });

  it('descrição curta permanece inteira no Shop9', () => {
    expect(descricaoPrimeiraReprogramacao('NF 45821 ACME', '2026-09-30', SHOP9_DESCRICAO_MAX)).toBe(
      `${PREFIXO_SHOP9}NF 45821 ACME`,
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
    expect(texto!.startsWith(PREFIXO_SHOP9)).toBe(true);
    expect(texto).toContain('PGTO');
    expect(texto).toContain('NF 45821');
    expect(texto).toContain('FORN');
    expect(texto).not.toContain('PAGAMENTO');
    expect(texto).not.toContain('NOTA FISCAL');
  });

  it('Nomus não corta texto longo', () => {
    const longa = 'PAGAMENTO '.repeat(20).trim();
    const texto = descricaoPrimeiraReprogramacao(longa, '2026-09-30');
    expect(texto).toBe(`${PREFIXO_NOMUS}${longa}`);
    expect(texto!.length).toBeGreaterThan(SHOP9_DESCRICAO_MAX);
  });

  it('aceita data vinda do driver como Date UTC', () => {
    const texto = descricaoPrimeiraReprogramacao('BOL 10', new Date('2026-09-30T00:00:00.000Z'), SHOP9_DESCRICAO_MAX);
    expect(texto).toBe('REP 30/09 BOL 10');
  });
});
