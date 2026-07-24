/**
 * Carry-forward e status de disponibilidade de materiais (calendário de produção).
 * Espelha a lógica de saldosENecessidadesHorizonte do frontend.
 */

export type CelDiaDisponibilidade = {
  consumo: number;
  entrada: number;
};

export type StatusMaterialDia = 'ok' | 'atencao' | 'falta';

export type SaldoDisponibilidadeOptions = {
  saldoInicial: number;
};

/** Um passe: saldo início do dia + necessidade acumulada. */
export function saldosENecessidadesDisponibilidade(
  dias: CelDiaDisponibilidade[],
  opts: SaldoDisponibilidadeOptions
): { saldosInicio: number[]; nAcum: number[] } {
  const saldosInicio: number[] = [];
  const nAcum: number[] = [];
  let nAnterior = 0;
  const saldo0 = Number.isFinite(opts.saldoInicial) ? Math.max(0, opts.saldoInicial) : 0;

  for (let i = 0; i < dias.length; i++) {
    let s: number;
    if (i === 0) {
      s = saldo0;
    } else {
      const prevS = saldosInicio[i - 1] ?? 0;
      const prevC = Number(dias[i - 1]?.consumo);
      const consumoAnterior = Number.isFinite(prevC) ? prevC : 0;
      const prevE = Number(dias[i - 1]?.entrada);
      const entradaAnterior = Number.isFinite(prevE) ? prevE : 0;
      s = prevS - consumoAnterior + entradaAnterior;
    }
    s = Math.max(0, s);
    saldosInicio.push(s);

    const consumo = Number(dias[i]?.consumo);
    const entrada = Number(dias[i]?.entrada);
    const c = Number.isFinite(consumo) ? consumo : 0;
    const e = Number.isFinite(entrada) ? entrada : 0;
    const bruto = c - (e + s) + nAnterior;
    const n = bruto <= 0 ? 0 : bruto;
    nAcum.push(n);
    nAnterior = n;
  }
  return { saldosInicio, nAcum };
}

/**
 * - falta: necessidade acumulada > 0
 * - atencao: saldo início < consumo, mas saldo+entrada cobrem (sem falta acum.)
 * - ok: demais
 */
export function statusCelulaMaterialDia(
  consumo: number,
  saldoInicio: number,
  entrada: number,
  nAcum: number
): StatusMaterialDia {
  if (nAcum > 0) return 'falta';
  const c = Number.isFinite(consumo) ? consumo : 0;
  const s = Number.isFinite(saldoInicio) ? saldoInicio : 0;
  const e = Number.isFinite(entrada) ? entrada : 0;
  if (c > 0 && s < c && s + e >= c) return 'atencao';
  return 'ok';
}

export function statusDiaAgregado(statuses: StatusMaterialDia[]): StatusMaterialDia {
  if (statuses.some((x) => x === 'falta')) return 'falta';
  if (statuses.some((x) => x === 'atencao')) return 'atencao';
  return 'ok';
}

export function primeiroIndiceRuptura(nAcum: number[]): number {
  for (let i = 0; i < nAcum.length; i++) {
    if (nAcum[i]! > 0) return i;
  }
  return -1;
}

export function arred2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Aceita YYYY-MM-DD ou dd/MM/yyyy e devolve ISO; vazio se inválido. */
export function normalizarDataIsoCalendario(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
  }
  return '';
}
