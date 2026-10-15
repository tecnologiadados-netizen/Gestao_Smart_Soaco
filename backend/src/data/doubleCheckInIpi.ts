/**
 * Conferência do IPI.
 * Até 14/10/2026 compara o valor em reais.
 * A partir de 15/10/2026 compara a alíquota do item da nota com a do item do pedido.
 * As 4 casas só eliminam ruído de ponto flutuante: não há faixa de tolerância.
 */
export const DOUBLE_CHECKIN_IPI_PERCENTUAL_DESDE_YMD = '2026-10-15';

const CASAS_ALIQUOTA_IPI = 4;

export type ConferenciaIpi = 'valor' | 'percentual';

export function conferenciaIpiPorDataEntrada(
  dataEntrada: string | null | undefined
): ConferenciaIpi {
  const ymd = String(dataEntrada ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'valor';
  return ymd >= DOUBLE_CHECKIN_IPI_PERCENTUAL_DESDE_YMD ? 'percentual' : 'valor';
}

export function arredondarAliquotaIpi(n: number | null | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** CASAS_ALIQUOTA_IPI;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/** True somente quando as duas alíquotas são o mesmo percentual. */
export function aliquotasIpiIguais(
  nf: number | null | undefined,
  pc: number | null | undefined
): boolean {
  return arredondarAliquotaIpi(nf) === arredondarAliquotaIpi(pc);
}

/** Alíquota da nota maior que a do pedido é divergência real. */
export function aliquotaIpiNfMaior(
  nf: number | null | undefined,
  pc: number | null | undefined
): boolean {
  return arredondarAliquotaIpi(nf) > arredondarAliquotaIpi(pc);
}
