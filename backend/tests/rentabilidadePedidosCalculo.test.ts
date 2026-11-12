import { describe, expect, it } from 'vitest';
import {
  agregarPedidoRentabilidade,
  calcularItemRentabilidade,
} from '../../frontend/src/lib/calculos/rentabilidadePedidos';
import {
  aliquotaDespesasPadrao,
  aliquotaImpostosVenda,
  PRECIFICACAO_PADROES,
} from '../../frontend/src/lib/calculos/precificacaoPadroes';

describe('cálculo Rentabilidade de Pedidos', () => {
  it('exemplo numérico do brief (impostos 18% / despesas 12% / custo 55)', () => {
    const item = calcularItemRentabilidade({
      qtde: 10,
      precoUnitario: 100,
      descontoItem: 0,
      custoUnitario: 55,
      aliquotaImpostosPct: 18,
      aliquotaDespesasPct: 12,
    });

    expect(item.receitaBruta).toBe(1000);
    expect(item.impostosVenda).toBe(180);
    expect(item.receitaLiquida).toBe(820);
    expect(item.cmv).toBe(550);
    expect(item.margemBruta).toBe(270);
    expect(item.margemBrutaPct).toBe(27);
    expect(item.despesas).toBe(120);
    expect(item.lucroLiquido).toBe(150);
    expect(item.margemLiquidaPct).toBe(15);
    expect(item.semCusto).toBe(false);
  });

  it('agrega pedido somando valores e recalculando margem sobre totais', () => {
    const a = calcularItemRentabilidade({
      qtde: 10,
      precoUnitario: 100,
      descontoItem: 0,
      custoUnitario: 55,
      aliquotaImpostosPct: 18,
      aliquotaDespesasPct: 12,
    });
    const b = calcularItemRentabilidade({
      qtde: 5,
      precoUnitario: 100,
      descontoItem: 0,
      custoUnitario: 55,
      aliquotaImpostosPct: 18,
      aliquotaDespesasPct: 12,
    });
    const ped = agregarPedidoRentabilidade([a, b]);
    expect(ped.receitaBruta).toBe(1500);
    expect(ped.lucroLiquido).toBe(225);
    expect(ped.margemLiquidaPct).toBe(15);
  });

  it('sinaliza item sem custo sem zerar CMV em silêncio (cmv=0 mas flag)', () => {
    const item = calcularItemRentabilidade({
      qtde: 2,
      precoUnitario: 50,
      descontoItem: 0,
      custoUnitario: null,
      aliquotaImpostosPct: 10,
      aliquotaDespesasPct: 12,
    });
    expect(item.semCusto).toBe(true);
    expect(item.cmv).toBe(0);
    expect(item.receitaBruta).toBe(100);
  });

  it('bonificado (receita zero) mantém CMV e despesas zero sobre receita', () => {
    const item = calcularItemRentabilidade({
      qtde: 3,
      precoUnitario: 0,
      descontoItem: 0,
      custoUnitario: 10,
      aliquotaImpostosPct: 18,
      aliquotaDespesasPct: 12,
    });
    expect(item.bonificado).toBe(true);
    expect(item.receitaBruta).toBe(0);
    expect(item.cmv).toBe(30);
    expect(item.despesas).toBe(0);
    expect(item.lucroLiquido).toBe(-30);
  });

  it('usa os mesmos % padrão da Precificação (despesas adm. e impostos)', () => {
    expect(aliquotaDespesasPadrao()).toBe(PRECIFICACAO_PADROES.despesasAdministrativas);
    expect(aliquotaImpostosVenda()).toBeCloseTo(
      PRECIFICACAO_PADROES.cofins +
        PRECIFICACAO_PADROES.pis +
        PRECIFICACAO_PADROES.csll +
        PRECIFICACAO_PADROES.irpj +
        PRECIFICACAO_PADROES.ipi +
        PRECIFICACAO_PADROES.icms,
      5
    );

    const item = calcularItemRentabilidade({
      qtde: 10,
      precoUnitario: 100,
      descontoItem: 0,
      custoUnitario: 55,
    });
    // Mesmo produto/preço → mesma margem quando usa padrões da Precificação
    const impostosEsperados = (1000 * aliquotaImpostosVenda()) / 100;
    const despesasEsperadas = (1000 * aliquotaDespesasPadrao()) / 100;
    expect(item.impostosVenda).toBe(Math.round(impostosEsperados * 100) / 100);
    expect(item.despesas).toBe(Math.round(despesasEsperadas * 100) / 100);
  });
});
