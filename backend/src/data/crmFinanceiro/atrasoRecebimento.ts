import { isFeriadoReconhecido, parseLocalDate } from './feriadosNacionais.js';
import type { Recebimento } from './types.js';

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / (24 * 60 * 60 * 1000));
}

/** Sábado, domingo ou feriado reconhecido — mesmo critério da coluna Data vencim. */
export function isVencimentoDiaNaoUtil(
  dataVencimento: string | null | undefined,
): boolean {
  if (!dataVencimento) return false;
  const date = parseLocalDate(dataVencimento);
  if (!date) return false;

  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return true;

  return isFeriadoReconhecido(toIsoDate(date));
}

/** Próximo dia útil após o vencimento quando este cai em sábado, domingo ou feriado. */
export function getPrazoEfetivoPagamento(
  dataVencimento: string,
  dataPagamento?: string | null,
): Date | null {
  const vencimento = parseLocalDate(dataVencimento);
  if (!vencimento) return null;

  if (!isVencimentoDiaNaoUtil(dataVencimento)) {
    return vencimento;
  }

  let prazo = addDays(vencimento, 1);
  while (isVencimentoDiaNaoUtil(toIsoDate(prazo))) {
    prazo = addDays(prazo, 1);
  }

  const pagamento = dataPagamento ? parseLocalDate(dataPagamento) : null;
  if (pagamento && pagamento >= vencimento) {
    let dia = addDays(vencimento, 1);
    let ultimoFeriadoNoIntervalo: Date | null = null;

    while (dia <= pagamento) {
      if (isFeriadoReconhecido(toIsoDate(dia))) {
        ultimoFeriadoNoIntervalo = dia;
      }
      dia = addDays(dia, 1);
    }

    if (ultimoFeriadoNoIntervalo) {
      let posFeriado = addDays(ultimoFeriadoNoIntervalo, 1);
      while (isVencimentoDiaNaoUtil(toIsoDate(posFeriado))) {
        posFeriado = addDays(posFeriado, 1);
      }
      if (posFeriado > prazo) {
        prazo = posFeriado;
      }
    }
  }

  return prazo;
}

function getDataPagamento(recebimento: Recebimento): Date | null {
  if (recebimento.dataRecebimento) {
    return parseLocalDate(recebimento.dataRecebimento);
  }
  if (recebimento.dataBaixa) {
    return parseLocalDate(recebimento.dataBaixa);
  }
  return null;
}

/**
 * Mesma convenção do banco: DATEDIFF(vencimento, pagamento).
 * Valor ≥ 0 = no prazo; < 0 = atrasado.
 */
export function calcularTotalDiasEfetivo(recebimento: Recebimento): number | null {
  if (recebimento.totalDias == null || !recebimento.dataVencimento) {
    return recebimento.totalDias;
  }

  const pagamento = getDataPagamento(recebimento);
  if (!pagamento) return recebimento.totalDias;

  const dataPagamentoIso = toIsoDate(pagamento);
  const prazoEfetivo = getPrazoEfetivoPagamento(
    recebimento.dataVencimento,
    dataPagamentoIso,
  );
  if (!prazoEfetivo) return recebimento.totalDias;

  return diffDays(prazoEfetivo, pagamento);
}

export function isRecebimentoEfetivamenteAtrasado(
  recebimento: Recebimento,
): boolean {
  const totalDias = calcularTotalDiasEfetivo(recebimento);
  return totalDias != null && totalDias < 0;
}

export function isRecebimentoNoPrazoEfetivo(recebimento: Recebimento): boolean {
  const totalDias = calcularTotalDiasEfetivo(recebimento);
  return totalDias != null && totalDias >= 0;
}

/** Atraso bruto no banco, mas desconsiderado por vencimento em dia não útil. */
export function isRecebimentoDesconsideradoPorDiaNaoUtil(
  recebimento: Recebimento,
): boolean {
  return (
    recebimento.totalDias != null &&
    recebimento.totalDias < 0 &&
    !isRecebimentoEfetivamenteAtrasado(recebimento)
  );
}

export function filtrarRecebimentosComTotalDias(
  recebimentos: Recebimento[],
): Recebimento[] {
  return recebimentos.filter((r) => r.totalDias != null);
}
