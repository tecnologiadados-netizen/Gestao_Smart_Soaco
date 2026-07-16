import type { SancaoDisciplinarRow } from "@rh/types/api";

export type SancaoColumnFilter =
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

export function rowMatchesSancaoColumnFilter(
  row: SancaoDisciplinarRow,
  key: keyof SancaoDisciplinarRow,
  f: SancaoColumnFilter | undefined,
): boolean {
  if (!f || f.kind === "all") return true;
  const cell = String(row[key] ?? "").trim();
  if (f.kind === "values") {
    if (f.allowed.length === 0) return false;
    return f.allowed.includes(cell);
  }
  const cellDate = toIsoDateOnly(cell);
  if (!cellDate) return false;
  if (f.start && cellDate < f.start) return false;
  if (f.end && cellDate > f.end) return false;
  return true;
}

export function columnUniqueSancaoValues(rows: SancaoDisciplinarRow[], key: keyof SancaoDisciplinarRow): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(String(r[key] ?? "").trim());
  }
  return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
}

export function displaySancaoCellFilterLabel(value: string): string {
  return value === "" ? "(Vazio)" : value;
}
