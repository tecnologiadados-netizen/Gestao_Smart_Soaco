import { describe, expect, it } from 'vitest';
import {
  calcularMediaAlteracoes,
  calcularPenalizacaoQualitativa,
  calcularPercentualFinal,
  calcularValorAPagar,
  chavePedidoItem,
  identificarNivelAtingido,
} from './painelProducaoApuracaoService.js';

describe('apuração qualitativa das metas', () => {
  it('calcula a média sobre os pedidos com alteração não abonada', () => {
    expect(calcularMediaAlteracoes(105, 26)).toBe(4.04);
    expect(calcularMediaAlteracoes(3, 0)).toBe(0);
  });

  it('aplica as faixas de penalização da política', () => {
    expect(calcularPenalizacaoQualitativa(1.99)).toBe(0);
    expect(calcularPenalizacaoQualitativa(2)).toBe(20);
    expect(calcularPenalizacaoQualitativa(4)).toBe(30);
    expect(calcularPenalizacaoQualitativa(5)).toBe(30);
    expect(calcularPenalizacaoQualitativa(5.01)).toBe(40);
  });

  it('normaliza chaves com ou sem prefixo de romaneio', () => {
    expect(chavePedidoItem('123-456')).toBe('123-456');
    expect(chavePedidoItem('0000000-123-0456')).toBe('123-456');
  });

  it('limita o quantitativo a 100% antes da penalização', () => {
    expect(calcularPercentualFinal(120, 20)).toBe(80);
    expect(calcularPercentualFinal(88.35, 0)).toBe(88.35);
  });

  it('desconta a penalização sobre o valor fixo do nível', () => {
    // Exemplo da política: nível de R$ 120,00 com −20% → R$ 96,00
    expect(calcularValorAPagar(120, 20)).toBe(96);
    expect(calcularValorAPagar(100, 30)).toBe(70);
    expect(calcularValorAPagar(80, 0)).toBe(80);
    expect(calcularValorAPagar(0, 40)).toBe(0);
  });

  it('identifica o maior nível alcançado pela produção', () => {
    const metas = { Bronze: 700, Prata: 800, Aço: 850 } as const;
    expect(identificarNivelAtingido(751, metas)).toBe('Bronze');
    expect(identificarNivelAtingido(830, metas)).toBe('Prata');
    expect(identificarNivelAtingido(850, metas)).toBe('Aço');
    expect(identificarNivelAtingido(500, metas)).toBeNull();
  });

  it('ignora níveis sem meta cadastrada', () => {
    expect(identificarNivelAtingido(900, { Bronze: null, Prata: 0, Aço: 850 })).toBe('Aço');
    expect(identificarNivelAtingido(900, { Bronze: null, Prata: null, Aço: null })).toBeNull();
  });
});
