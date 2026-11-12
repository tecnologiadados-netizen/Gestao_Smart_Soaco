/** Espelho de frontend/src/lib/calculos/rentabilidadePedidos.ts */
import { aliquotaDespesasPadrao, aliquotaImpostosVenda } from './precificacaoPadroes.js';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type EntradaItemRentabilidade = {
  qtde: number;
  precoUnitario: number;
  descontoItem: number;
  rateioDescontoCabecalho?: number;
  custoUnitario: number | null;
  aliquotaImpostosPct?: number;
  aliquotaDespesasPct?: number;
  despesasPadraoGeral?: boolean;
};

export type ResultadoItemRentabilidade = {
  receitaBruta: number;
  impostosVenda: number;
  receitaLiquida: number;
  cmv: number;
  margemBruta: number;
  margemBrutaPct: number | null;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number | null;
  semCusto: boolean;
  bonificado: boolean;
  despesasPadraoGeral: boolean;
  aliquotaImpostosPct: number;
  aliquotaDespesasPct: number;
};

export function calcularItemRentabilidade(e: EntradaItemRentabilidade): ResultadoItemRentabilidade {
  const qtde = Number.isFinite(e.qtde) ? e.qtde : 0;
  const preco = Number.isFinite(e.precoUnitario) ? e.precoUnitario : 0;
  const descItem = Number.isFinite(e.descontoItem) ? e.descontoItem : 0;
  const rateio = Number.isFinite(e.rateioDescontoCabecalho) ? (e.rateioDescontoCabecalho ?? 0) : 0;

  const receitaBruta = round2(Math.max(0, qtde * preco - descItem - rateio));
  const bonificado = receitaBruta <= 0;

  const aliquotaImpostosPct =
    e.aliquotaImpostosPct != null && Number.isFinite(e.aliquotaImpostosPct)
      ? e.aliquotaImpostosPct
      : aliquotaImpostosVenda();
  const aliquotaDespesasPct =
    e.aliquotaDespesasPct != null && Number.isFinite(e.aliquotaDespesasPct)
      ? e.aliquotaDespesasPct
      : aliquotaDespesasPadrao();

  const impostosVenda = round2((receitaBruta * aliquotaImpostosPct) / 100);
  const receitaLiquida = round2(receitaBruta - impostosVenda);

  const semCusto = e.custoUnitario == null || !Number.isFinite(e.custoUnitario);
  const cmv = semCusto ? 0 : round2(qtde * (e.custoUnitario as number));
  const margemBruta = round2(receitaLiquida - cmv);
  const margemBrutaPct = receitaBruta > 0 ? round1((margemBruta / receitaBruta) * 100) : null;

  const despesas = round2((receitaBruta * aliquotaDespesasPct) / 100);
  const lucroLiquido = round2(margemBruta - despesas);
  const margemLiquidaPct = receitaBruta > 0 ? round1((lucroLiquido / receitaBruta) * 100) : null;

  return {
    receitaBruta,
    impostosVenda,
    receitaLiquida,
    cmv,
    margemBruta,
    margemBrutaPct,
    despesas,
    lucroLiquido,
    margemLiquidaPct,
    semCusto,
    bonificado,
    despesasPadraoGeral: e.despesasPadraoGeral ?? true,
    aliquotaImpostosPct,
    aliquotaDespesasPct,
  };
}

export type ResultadoPedidoRentabilidade = {
  receitaBruta: number;
  impostosVenda: number;
  receitaLiquida: number;
  cmv: number;
  margemBruta: number;
  margemBrutaPct: number | null;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number | null;
  qtdeItensSemCusto: number;
  qtdeItensBonificados: number;
};

export function agregarPedidoRentabilidade(
  itens: ResultadoItemRentabilidade[]
): ResultadoPedidoRentabilidade {
  const receitaBruta = round2(itens.reduce((s, i) => s + i.receitaBruta, 0));
  const impostosVenda = round2(itens.reduce((s, i) => s + i.impostosVenda, 0));
  const receitaLiquida = round2(itens.reduce((s, i) => s + i.receitaLiquida, 0));
  const cmv = round2(itens.reduce((s, i) => s + i.cmv, 0));
  const margemBruta = round2(itens.reduce((s, i) => s + i.margemBruta, 0));
  const despesas = round2(itens.reduce((s, i) => s + i.despesas, 0));
  const lucroLiquido = round2(itens.reduce((s, i) => s + i.lucroLiquido, 0));

  return {
    receitaBruta,
    impostosVenda,
    receitaLiquida,
    cmv,
    margemBruta,
    margemBrutaPct: receitaBruta > 0 ? round1((margemBruta / receitaBruta) * 100) : null,
    despesas,
    lucroLiquido,
    margemLiquidaPct: receitaBruta > 0 ? round1((lucroLiquido / receitaBruta) * 100) : null,
    qtdeItensSemCusto: itens.filter((i) => i.semCusto).length,
    qtdeItensBonificados: itens.filter((i) => i.bonificado).length,
  };
}

export type StatusLucroRentabilidade = 'positivo' | 'neutro' | 'prejuizo';

export function statusLucroOperacao(
  lucroLiquido: number,
  margemLiquidaPct: number | null
): StatusLucroRentabilidade {
  if (lucroLiquido < 0) return 'prejuizo';
  if (margemLiquidaPct != null && margemLiquidaPct < 2) return 'neutro';
  return 'positivo';
}
