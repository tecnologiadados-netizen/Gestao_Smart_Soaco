import { parseLocalDate } from './datasLocais.js';
import { isFeriadoNordestePopular } from './feriadosNordeste.js';

export { parseLocalDate } from './datasLocais.js';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Algoritmo de Meeus/Jones/Butcher para o domingo de Páscoa */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function isFixedFeriadoNacional(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  const fixed: Array<[number, number]> = [
    [0, 1],
    [3, 21],
    [4, 1],
    [8, 7],
    [9, 12],
    [10, 2],
    [10, 15],
    [11, 25],
  ];

  if (fixed.some(([m, d]) => m === month && d === day)) {
    return true;
  }

  // Lei 14.759/2023 — feriado nacional a partir de 2024
  if (year >= 2024 && month === 10 && day === 20) {
    return true;
  }

  return false;
}

function isMobileFeriadoNacional(date: Date): boolean {
  const year = date.getFullYear();
  const easter = getEasterSunday(year);
  const sextaFeiraSanta = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return (
    isSameDay(date, sextaFeiraSanta) || isSameDay(date, corpusChristi)
  );
}

export function isFeriadoNacional(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = parseLocalDate(value);
  if (!date) return false;

  return isFixedFeriadoNacional(date) || isMobileFeriadoNacional(date);
}

/** Feriados nacionais + feriados populares do Nordeste (para vencimento e atraso). */
export function isFeriadoReconhecido(value: string | null | undefined): boolean {
  return isFeriadoNacional(value) || isFeriadoNordestePopular(value);
}
