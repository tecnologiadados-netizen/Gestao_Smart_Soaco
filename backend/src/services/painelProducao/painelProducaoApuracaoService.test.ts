import { describe, expect, it } from 'vitest';
import {
  calcularMediaAlteracoes,
  calcularParcelaProducao,
  calcularPenalizacaoQualitativa,
  calcularPercentualFinal,
  calcularValorAPagar,
  chavePedidoItem,
  consolidarPerfiladeiras,
  identificarNivelAtingido,
  niveisCompletos,
  VALOR_UNITARIO_PRODUCAO,
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

  it('aplica as faixas de desconto cadastradas para o mês', () => {
    const faixas = [
      { media_min: 0, media_max: 2.49, percentual_desconto: 0 },
      { media_min: 2.5, media_max: 4.99, percentual_desconto: 15 },
      { media_min: 5, media_max: null, percentual_desconto: 35 },
    ];
    expect(calcularPenalizacaoQualitativa(3.2, faixas)).toBe(15);
    expect(calcularPenalizacaoQualitativa(5, faixas)).toBe(35);
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

  it('exige os três níveis para elegibilidade do setor', () => {
    expect(niveisCompletos({ Bronze: 700, Prata: 800, Aço: 850 })).toBe(true);
    expect(niveisCompletos({ Bronze: null, Prata: 800, Aço: 850 })).toBe(false);
    expect(niveisCompletos({ Bronze: 0, Prata: 800, Aço: 850 })).toBe(false);
  });
});

describe('apuração dos setores de produção', () => {
  it('usa os valores unitários da política', () => {
    expect(VALOR_UNITARIO_PRODUCAO.Bronze).toBe(8.3);
    expect(VALOR_UNITARIO_PRODUCAO.Prata).toBe(16.6);
    expect(VALOR_UNITARIO_PRODUCAO.Aço).toBe(25);
  });

  it('paga a parcela integral quando a média de ruptura é menor que 2', () => {
    const parcela = calcularParcelaProducao('Bronze', 1, 30);
    expect(parcela.impactoProducao).toBe(false);
    expect(parcela.percentualHerdado).toBe(0);
    expect(parcela.parcelaFinal).toBe(8.3);
    expect(parcela.desconto).toBe(0);
  });

  it('ignora herança de penalização quando o mês desliga as penalizações', () => {
    const parcela = calcularParcelaProducao('Aço', 6, 40, false);
    expect(parcela.impactoProducao).toBe(false);
    expect(parcela.percentualHerdado).toBe(0);
    expect(parcela.parcelaFinal).toBe(25);
  });

  it('herda a penalização da montagem quando a média de ruptura é ≥ 2', () => {
    // Exemplo da política: Bronze R$ 8,30 com −30% → R$ 5,81
    const parcela = calcularParcelaProducao('Bronze', 3, 30);
    expect(parcela.impactoProducao).toBe(true);
    expect(parcela.percentualHerdado).toBe(30);
    expect(parcela.parcelaFinal).toBe(5.81);
    expect(parcela.desconto).toBe(2.49);
  });

  it('exige no mínimo 3 setores com nível atingido', () => {
    const abaixo = consolidarPerfiladeiras([
      { nivel: 'Bronze', valorBase: 8.3, parcelaFinal: 8.3, impactoProducao: false },
      { nivel: 'Bronze', valorBase: 8.3, parcelaFinal: 8.3, impactoProducao: false },
    ]);
    expect(abaixo.elegivel).toBe(false);
    expect(abaixo.valorFinal).toBe(0);
    expect(abaixo.valorBruto).toBe(16.6);

    const ok = consolidarPerfiladeiras([
      { nivel: 'Bronze', valorBase: 8.3, parcelaFinal: 8.3, impactoProducao: false },
      { nivel: 'Bronze', valorBase: 8.3, parcelaFinal: 8.3, impactoProducao: false },
      { nivel: 'Bronze', valorBase: 8.3, parcelaFinal: 5.81, impactoProducao: true },
    ]);
    expect(ok.elegivel).toBe(true);
    expect(ok.setoresAtingiram).toBe(3);
    expect(ok.parcelasPenalizadas).toBe(1);
    // (2 × 8,30) + 5,81 = 22,41
    expect(ok.valorFinal).toBe(22.41);
    expect(ok.valorBruto).toBe(24.9);
  });

  it('reconcilia valor bruto e final com a soma das parcelas', () => {
    const parcelas = [
      { nivel: 'Bronze' as const, valorBase: 8.3, parcelaFinal: 8.3, impactoProducao: false },
      { nivel: 'Prata' as const, valorBase: 16.6, parcelaFinal: 16.6, impactoProducao: false },
      { nivel: 'Aço' as const, valorBase: 25, parcelaFinal: 17.5, impactoProducao: true },
      { nivel: null, valorBase: 0, parcelaFinal: 0, impactoProducao: false },
    ];
    const consolidado = consolidarPerfiladeiras(parcelas);
    expect(consolidado.distribuicao).toEqual({ Bronze: 1, Prata: 1, Aço: 1 });
    expect(consolidado.valorBruto).toBe(49.9);
    expect(consolidado.valorFinal).toBe(42.4);
    expect(consolidado.parcelasPenalizadas).toBe(1);
  });
});
