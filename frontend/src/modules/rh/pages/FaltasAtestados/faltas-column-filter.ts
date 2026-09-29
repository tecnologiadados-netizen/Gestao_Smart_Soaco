import type { FaltaRow } from "@rh/types/api";
import { normalizarMesFalta } from "@rh/pages/FaltasAtestados/mes-falta";

/** Filtro estilo planilha: todos os valores ou subconjunto explícito (por texto exato da célula, trim). */
export type FaltaColumnFilter =
  | { kind: "all" }
  | { kind: "values"; allowed: string[] }
  | { kind: "dateRange"; start: string | null; end: string | null };

function toIsoDateOnly(value: string): string | null {
  const raw = String(value ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export function rowMatchesColumnFilter(
  row: FaltaRow,
  key: keyof FaltaRow,
  f: FaltaColumnFilter | undefined,
): boolean {
  if (!f || f.kind === "all") return true;
  const cell = cellValueForColumnFilter(row, key);
  if (f.kind === "values") {
    if (f.allowed.length === 0) return false;
    const allowed = key === "mesFalta" ? f.allowed.map((v) => normalizarMesFalta(v)) : f.allowed;
    return allowed.includes(cell);
  }
  const cellDate = toIsoDateOnly(cell);
  if (!cellDate) return false;
  if (f.start && cellDate < f.start) return false;
  if (f.end && cellDate > f.end) return false;
  return true;
}

function cellValueForColumnFilter(row: FaltaRow, key: keyof FaltaRow): string {
  const raw = String(row[key] ?? "").trim();
  return key === "mesFalta" ? normalizarMesFalta(raw) : raw;
}

export function columnUniqueValues(rows: FaltaRow[], key: keyof FaltaRow): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(cellValueForColumnFilter(r, key));
  }
  return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
}

export function displayCellFilterLabel(value: string): string {
  return value === "" ? "(Vazio)" : value;
}
