import type { DoubleCheckInCampoComparativo } from '../data/doubleCheckInLocalRepository.js';
import { isFeriadoNacional } from '../data/crmFinanceiro/feriadosNacionais.js';
import { parseLocalDate } from '../data/crmFinanceiro/datasLocais.js';

export type NaturezaDivergencia = 'benigna' | 'real';

type ParcelaPrazo = {
  dias: number | null;
  dataBase?: string | null;
  dataVencimento?: string | null;
};

export type LinhaClassificavel = {
  valorUnitarioNF?: number;
  valorUnitarioPC?: number;
  qtdeNF?: number;
  qtdePC?: number;
  valorIpiNF?: number;
  valorIpiPC?: number;
  parcelasNF?: ParcelaPrazo[];
  parcelasPC?: ParcelaPrazo[];
  prazosDiasNF?: number[];
  prazosDiasPC?: number[];
  dataBaseParcelasNF?: string | null;
  dataBaseParcelasPC?: string | null;
};

export const OBS_PAGAMENTO_AJUSTE_DIA_UTIL =
  'O Nomus empurrou o vencimento para o próximo dia útil (fim de semana ou feriado). A condição cadastral é a mesma.';

const JUSTIFICATIVAS_BENIGNAS = new Set([
  'arredondamento',
  'divergencia_so_na_tela',
  'ipi_reflexo',
]);

export function justificativaIndicaDivergenciaBenigna(
  justificativaCodigo: string | null | undefined
): boolean {
  return JUSTIFICATIVAS_BENIGNAS.has((justificativaCodigo ?? '').trim());
}

function numero(v: number | null | undefined): number {
  return Number.isFinite(v) ? Number(v) : 0;
}

function centavos(v: number | null | undefined): number {
  return Math.round(numero(v) * 100);
}

function diasPagamento(
  parcelas: ParcelaPrazo[] | undefined,
  fallback: number[] | undefined
): number[] {
  const pelasParcelas = (parcelas ?? [])
    .map((p) => p.dias)
    .filter((d): d is number => Number.isFinite(d));
  if (pelasParcelas.length > 0) return pelasParcelas;
  return (fallback ?? []).filter((d) => Number.isFinite(d));
}

function ymdValido(v: string | null | undefined): string | null {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function addDaysYmd(ymd: string, days: number): string | null {
  const d = parseLocalDate(ymd);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ehFimDeSemana(ymd: string): boolean {
  const d = parseLocalDate(ymd);
  if (!d) return false;
  const w = d.getDay();
  return w === 0 || w === 6;
}

function ehDiaNaoUtil(ymd: string): boolean {
  return ehFimDeSemana(ymd) || isFeriadoNacional(ymd);
}

/** Se a data já é útil, devolve ela; senão, o próximo dia útil. */
export function proximoDiaUtilPagamento(ymd: string): string {
  let atual = ymd;
  for (let i = 0; i < 15; i++) {
    if (!ehDiaNaoUtil(atual)) return atual;
    const next = addDaysYmd(atual, 1);
    if (!next) return atual;
    atual = next;
  }
  return atual;
}

function vencimentoParcela(
  parcela: ParcelaPrazo | undefined,
  dataBaseFallback: string | null | undefined,
  diasFallback: number | undefined
): string | null {
  const venc = ymdValido(parcela?.dataVencimento);
  if (venc) return venc;
  const base = ymdValido(parcela?.dataBase) ?? ymdValido(dataBaseFallback);
  const dias = Number.isFinite(parcela?.dias) ? Number(parcela?.dias) : diasFallback;
  if (!base || dias == null || !Number.isFinite(dias)) return null;
  return addDaysYmd(base, dias);
}

function umVencimentoEAjusteDiaUtilDoOutro(a: string, b: string): boolean {
  if (a === b) return true;
  const earlier = a < b ? a : b;
  const later = a < b ? b : a;
  return ehDiaNaoUtil(earlier) && proximoDiaUtilPagamento(earlier) === later;
}

/**
 * True quando a diferença de prazos é só o Nomus empurrando o vencimento
 * de sábado/domingo/feriado para o próximo dia útil.
 */
export function ehAjusteDiaUtilPagamento(linha: LinhaClassificavel): boolean {
  const diasNF = diasPagamento(linha.parcelasNF, linha.prazosDiasNF);
  const diasPC = diasPagamento(linha.parcelasPC, linha.prazosDiasPC);
  if (diasNF.length === 0 || diasNF.length !== diasPC.length) return false;
  if (diasNF.every((d, i) => d === diasPC[i])) return false;

  let algumaDiferencaAjustada = false;
  for (let i = 0; i < diasNF.length; i++) {
    if (diasNF[i] === diasPC[i]) continue;
    const vencNF = vencimentoParcela(
      linha.parcelasNF?.[i],
      linha.dataBaseParcelasNF,
      diasNF[i]
    );
    const vencPC = vencimentoParcela(
      linha.parcelasPC?.[i],
      linha.dataBaseParcelasPC,
      diasPC[i]
    );
    if (!vencNF || !vencPC) return false;
    if (!umVencimentoEAjusteDiaUtilDoOutro(vencNF, vencPC)) return false;
    algumaDiferencaAjustada = true;
  }
  return algumaDiferencaAjustada;
}

export function observacaoNaturezaDivergencia(params: {
  linha: LinhaClassificavel;
  campo: DoubleCheckInCampoComparativo;
}): string | null {
  if (params.campo !== 'condicao_pagamento') return null;
  return ehAjusteDiaUtilPagamento(params.linha) ? OBS_PAGAMENTO_AJUSTE_DIA_UTIL : null;
}

/**
 * Classifica o impacto para a empresa, independentemente da decisão aceita/recusa.
 * Na dúvida, retorna "real" para não esconder um risco do alerta.
 */
export function classificarNaturezaDivergencia(params: {
  linha: LinhaClassificavel;
  campo: DoubleCheckInCampoComparativo;
  justificativaCodigo?: string | null;
}): NaturezaDivergencia {
  if (justificativaIndicaDivergenciaBenigna(params.justificativaCodigo)) return 'benigna';

  const { linha, campo } = params;
  if (campo === 'valor_unitario') {
    return centavos(linha.valorUnitarioNF) <= centavos(linha.valorUnitarioPC)
      ? 'benigna'
      : 'real';
  }

  // Quantidade diferente exige avaliação, inclusive em entrega parcial.
  if (campo === 'qtde') return 'real';

  if (campo === 'ipi') {
    return centavos(linha.valorIpiNF) <= centavos(linha.valorIpiPC)
      ? 'benigna'
      : 'real';
  }

  if (ehAjusteDiaUtilPagamento(linha)) return 'benigna';

  const diasNF = diasPagamento(linha.parcelasNF, linha.prazosDiasNF);
  const diasPC = diasPagamento(linha.parcelasPC, linha.prazosDiasPC);
  const temPrazosNosDois = diasNF.length > 0 && diasPC.length > 0;
  const mesmaEstrutura = temPrazosNosDois && diasNF.length === diasPC.length;
  const parcelasCorrespondentesIguaisOuMelhores =
    mesmaEstrutura && diasNF.every((dias, i) => dias >= (diasPC[i] ?? Number.POSITIVE_INFINITY));
  // Com estruturas diferentes, só considera benigno quando o cronograma inteiro da NF
  // é posterior ao do PC. Isso evita esconder casos mistos sem equivalência entre parcelas.
  const cronogramaNfInteiroPosterior =
    temPrazosNosDois &&
    diasNF.length !== diasPC.length &&
    Math.min(...diasNF) >= Math.max(...diasPC);
  const prazoIgualOuMelhor =
    parcelasCorrespondentesIguaisOuMelhores || cronogramaNfInteiroPosterior;
  return prazoIgualOuMelhor ? 'benigna' : 'real';
}

export function rotuloNaturezaDivergencia(natureza: NaturezaDivergencia): string {
  return natureza === 'benigna' ? 'Divergência benigna' : 'Divergência real';
}
