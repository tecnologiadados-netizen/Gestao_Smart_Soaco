import type { DoubleCheckInCampoComparativo } from '../data/doubleCheckInLocalRepository.js';

export type NaturezaDivergencia = 'benigna' | 'real';

type ParcelaPrazo = { dias: number | null };

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
};

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

  const diasNF = diasPagamento(linha.parcelasNF, linha.prazosDiasNF);
  const diasPC = diasPagamento(linha.parcelasPC, linha.prazosDiasPC);
  const mesmaEstrutura = diasNF.length > 0 && diasNF.length === diasPC.length;
  const prazoIgualOuMelhor =
    mesmaEstrutura && diasNF.every((dias, i) => dias >= (diasPC[i] ?? Number.POSITIVE_INFINITY));
  return prazoIgualOuMelhor ? 'benigna' : 'real';
}

export function rotuloNaturezaDivergencia(natureza: NaturezaDivergencia): string {
  return natureza === 'benigna' ? 'Divergência benigna' : 'Divergência real';
}
