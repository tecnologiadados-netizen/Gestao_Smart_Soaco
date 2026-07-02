import type { DreEstruturaNo } from './ArvoreContasDre';
import {
  DFC_ID_EMPRESA_REFRIGERACAO,
  DFC_ID_EMPRESA_RN_MARQUES,
} from '../dfc/dfcEmpresas';

export const CODIGO_SIMPLES_NACIONAL = '4.14';
export const CODIGO_BASE_REFRIGERACAO = '1.5';
export const CODIGO_BASE_RN_MARQUES_INDIRETO = '1.6.2';

function encontrarNoPorCodigo(nodes: DreEstruturaNo[], codigo: string): DreEstruturaNo | null {
  for (const n of nodes) {
    if (n.codigo === codigo) return n;
    const achado = encontrarNoPorCodigo(n.children ?? [], codigo);
    if (achado) return achado;
  }
  return null;
}

/** Rateio proporcional com ajuste de centavos no maior peso. */
export function rateioProporcional(total: number, pesos: number[]): number[] {
  const absTotal = Math.abs(total);
  if (absTotal <= 0) return pesos.map(() => 0);
  const sumPesos = pesos.reduce((a, b) => a + b, 0);
  if (sumPesos <= 0) return pesos.map(() => 0);

  const raw = pesos.map((p) => absTotal * (p / sumPesos));
  const rounded = raw.map((v) => Math.round(v * 100) / 100);
  const diff = Math.round((absTotal - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (Math.abs(diff) >= 0.01) {
    let idxMax = 0;
    for (let i = 1; i < pesos.length; i++) {
      if (pesos[i]! > pesos[idxMax]!) idxMax = i;
    }
    rounded[idxMax] = Math.round((rounded[idxMax]! + diff) * 100) / 100;
  }
  const sinal = total < 0 ? -1 : 1;
  return rounded.map((v) => sinal * v);
}

function receitaAbsolutaPorPeriodo(
  pathKey: string,
  periodo: string,
  mapas: Map<string, Record<string, number>>[],
): number {
  let v = 0;
  for (const m of mapas) {
    v += Math.abs(m.get(pathKey)?.[periodo] ?? 0);
  }
  return v;
}

export type DreSimplesRateioPeriodo = {
  periodo: string;
  baseRefrigeracao: number;
  baseRnMarques: number;
  baseTotal: number;
  pctRefrigeracao: number;
  pctRnMarques: number;
};

/** Valor do Simples (4.14) exibido na grade conforme empresas selecionadas. */
export function valorSimplesGradePorEmpresas(
  simplesTotal: number,
  partRefrigeracao: number,
  partRnMarques: number,
  idEmpresas: number[],
): number {
  return valorExibidoRateioEmpresas(
    simplesTotal,
    {
      [DFC_ID_EMPRESA_REFRIGERACAO]: partRefrigeracao,
      [DFC_ID_EMPRESA_RN_MARQUES]: partRnMarques,
    },
    idEmpresas,
    [DFC_ID_EMPRESA_REFRIGERACAO, DFC_ID_EMPRESA_RN_MARQUES],
  );
}

/** Soma das parcelas rateadas conforme filtro de empresas (todas participantes → valor integral). */
export function valorExibidoRateioEmpresas(
  total: number,
  partes: Record<number, number>,
  idEmpresas: number[],
  idsParticipantes: number[],
): number {
  if (idsParticipantes.length === 2) {
    const [a, b] = idsParticipantes;
    const temA = a != null && idEmpresas.includes(a);
    const temB = b != null && idEmpresas.includes(b);
    if (temA && temB) return total;
    if (temA) return partes[a] ?? 0;
    if (temB) return partes[b] ?? 0;
    return 0;
  }
  const temTodos = idsParticipantes.length > 0 && idsParticipantes.every((id) => idEmpresas.includes(id));
  if (temTodos) return total;
  return idEmpresas.reduce((s, id) => s + (partes[id] ?? 0), 0);
}

/** Percentuais de rateio Simples Nacional por período (bases 1.5 e 1.6.2). */
export function montarRateioSimplesPorPeriodo(
  roots: DreEstruturaNo[],
  periodos: string[],
  mapasReceitaBase: Map<string, Record<string, number>>[],
): Map<string, DreSimplesRateioPeriodo> {
  const out = new Map<string, DreSimplesRateioPeriodo>();
  const noRef = encontrarNoPorCodigo(roots, CODIGO_BASE_REFRIGERACAO);
  const noRn = encontrarNoPorCodigo(roots, CODIGO_BASE_RN_MARQUES_INDIRETO);
  if (!noRef || !noRn || mapasReceitaBase.length === 0) return out;

  for (const periodo of periodos) {
    const baseRefrigeracao = receitaAbsolutaPorPeriodo(noRef.pathKey, periodo, mapasReceitaBase);
    const baseRnMarques = receitaAbsolutaPorPeriodo(noRn.pathKey, periodo, mapasReceitaBase);
    const baseTotal = baseRefrigeracao + baseRnMarques;
    if (baseTotal <= 0) continue;
    out.set(periodo, {
      periodo,
      baseRefrigeracao,
      baseRnMarques,
      baseTotal,
      pctRefrigeracao: baseRefrigeracao / baseTotal,
      pctRnMarques: baseRnMarques / baseTotal,
    });
  }
  return out;
}

export function periodoLinhaDetalheSimples(
  dataBaixa: string | null | undefined,
  granularidade: 'dia' | 'mes',
): string | null {
  const ymd = dataBaixa?.slice(0, 10);
  if (!ymd || ymd.length < 7) return null;
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

export function rateioValoresLinhaSimples(
  valorLinha: number,
  ctx: DreSimplesRateioPeriodo | undefined,
): { refrigeracao: number; rnMarques: number } | null {
  if (!ctx || ctx.baseTotal <= 0 || Math.abs(valorLinha) < 0.005) return null;
  const [refrigeracao, rnMarques] = rateioProporcional(valorLinha, [
    ctx.baseRefrigeracao,
    ctx.baseRnMarques,
  ]);
  return { refrigeracao, rnMarques };
}

const nfRateio = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: 'percent',
});

/** Texto do tooltip de rateio (lançamento ou total). */
export function montarTooltipRateioSimples(params: {
  ctx: DreSimplesRateioPeriodo;
  valorOriginal: number;
  refrigeracao: number;
  rnMarques: number;
  rotuloPeriodo?: string;
  idEmpresas?: number[];
}): string {
  const { ctx, valorOriginal, refrigeracao, rnMarques, rotuloPeriodo, idEmpresas } = params;
  const exibido =
    idEmpresas != null
      ? valorSimplesGradePorEmpresas(valorOriginal, refrigeracao, rnMarques, idEmpresas)
      : valorOriginal;
  const linhas = [
    `Rateio Simples Nacional${rotuloPeriodo ? ` · ${rotuloPeriodo}` : ''}`,
    '',
    `Base 1.5 Só Refrigeração: ${nfRateio.format(ctx.baseRefrigeracao)} (${nfPct.format(ctx.pctRefrigeracao)})`,
    `Base 1.6.2 R N Marques: ${nfRateio.format(ctx.baseRnMarques)} (${nfPct.format(ctx.pctRnMarques)})`,
    '',
    `Valor integral: ${nfRateio.format(valorOriginal)}`,
    `→ Só Refrigeração: ${nfRateio.format(refrigeracao)}`,
    `→ R N Marques: ${nfRateio.format(rnMarques)}`,
  ];
  if (idEmpresas != null) {
    linhas.push('', `Exibido na grade (filtro empresas): ${nfRateio.format(exibido)}`);
  }
  return linhas.join('\n');
}

export { nfRateio as nfRateioSimples, nfPct as nfPctRateioSimples };

/**
 * Modela o Simples Nacional (4.14) na linha única:
 * rateio por 1.5 / 1.6.2 (pool = total − Simples direto filial 6) e recorte conforme empresas selecionadas.
 * RN Marques exibe parcela rateada + Simples integral da filial 6.
 */
export function aplicarRateioSimplesNacionalNasSaidas(
  saidasMap: Map<string, Record<string, number>>,
  roots: DreEstruturaNo[],
  periodos: string[],
  mapasReceitaBase: Map<string, Record<string, number>>[],
  idEmpresas: number[],
  /** Total integral do Simples (ex.: saídas Ref+RN) quando o filtro de empresa recorta o mapa base. */
  saidasMapFonteSimples?: Map<string, Record<string, number>>,
  /** Simples direto na filial 6 Shop9 por período — não entra no pool de rateio. */
  simplesNacionalFilial6PorPeriodo?: Record<string, number>,
): Map<string, Record<string, number>> {
  const out = new Map(saidasMap);
  const noSimples = encontrarNoPorCodigo(roots, CODIGO_SIMPLES_NACIONAL);
  const noRef = encontrarNoPorCodigo(roots, CODIGO_BASE_REFRIGERACAO);
  const noRn = encontrarNoPorCodigo(roots, CODIGO_BASE_RN_MARQUES_INDIRETO);
  if (!noSimples || !noRef || !noRn) return out;

  const fonteSimples = saidasMapFonteSimples ?? saidasMap;
  const totalSimples = fonteSimples.get(noSimples.pathKey);
  if (!totalSimples) return out;

  const modelado: Record<string, number> = { ...totalSimples };
  let alterou = false;

  for (const p of periodos) {
    const simplesTotalSigned = totalSimples[p] ?? 0;
    if (Math.abs(simplesTotalSigned) < 0.005) continue;

    const sinalDespesa = simplesTotalSigned < 0 ? -1 : 1;
    const simplesTotalAbs = Math.abs(simplesTotalSigned);
    const simplesFilial6Abs = Math.min(
      Math.abs(simplesNacionalFilial6PorPeriodo?.[p] ?? 0),
      simplesTotalAbs,
    );
    const simplesFilial6Signed = sinalDespesa * simplesFilial6Abs;
    const simplesPoolRateioAbs = Math.max(0, simplesTotalAbs - simplesFilial6Abs);
    const simplesPoolRateioSigned = sinalDespesa * simplesPoolRateioAbs;

    const baseRef = receitaAbsolutaPorPeriodo(noRef.pathKey, p, mapasReceitaBase);
    const baseRn = receitaAbsolutaPorPeriodo(noRn.pathKey, p, mapasReceitaBase);
    const baseTotal = baseRef + baseRn;

    let partRef = 0;
    let partRn = simplesFilial6Signed;

    if (baseTotal > 0 && simplesPoolRateioAbs >= 0.005) {
      const [rRef, rRn] = rateioProporcional(simplesPoolRateioSigned, [baseRef, baseRn]);
      partRef = rRef;
      partRn = rRn + simplesFilial6Signed;
    } else if (simplesFilial6Abs < 0.005) {
      continue;
    }

    modelado[p] = valorSimplesGradePorEmpresas(simplesTotalSigned, partRef, partRn, idEmpresas);
    alterou = true;
  }

  if (!alterou) return out;
  out.set(noSimples.pathKey, modelado);
  return out;
}
