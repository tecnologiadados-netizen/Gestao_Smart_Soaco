import { isFeriadoReconhecido, parseLocalDate } from './feriadosNacionais.js';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseLocalDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function formatWeekday(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = parseLocalDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
}

export function isWeekendWeekday(value: string | null | undefined): boolean {
  const weekday = formatWeekday(value);
  if (!weekday) return false;
  const normalized = weekday
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized === "sabado" || normalized === "domingo";
}

/** Sábado, domingo ou feriado (nacional + Nordeste) — legenda laranja na coluna Data vencim. */
export function shouldHighlightVencimentoDayLabel(
  value: string | null | undefined,
): boolean {
  return isWeekendWeekday(value) || isFeriadoReconhecido(value);
}

/** Data + dia da semana (ex.: 10/07/2026 + segunda-feira) */
export function formatDateWithWeekday(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseLocalDate(value);
  if (!date) return "—";
  const formatted = new Intl.DateTimeFormat("pt-BR").format(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return `${formatted}\n${weekday}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

export function formatText(value: string | null | undefined): string {
  if (value == null) return "—";
  const text = value.trim();
  return text || "—";
}

export function isTituloDescontado(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toUpperCase() === "TITULO DESCONTADO";
}

/** diasAtraso = DATEDIFF(CURDATE(), vencimento) — positivo quando vencido */
export function formatDiasAtraso(diasAtraso: number): string {
  return diasAtraso > 0 ? String(diasAtraso) : "—";
}

/** Dias restantes até o vencimento (contas em dia) */
export function formatDiasAteAtrasar(
  diasAtraso: number,
  dataVencimento: string | null | undefined,
): string {
  if (!dataVencimento) return "—";
  if (diasAtraso < 0) return String(-diasAtraso);
  if (diasAtraso === 0) return "0";
  return "—";
}
