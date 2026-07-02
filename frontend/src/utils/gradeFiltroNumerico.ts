/** Prefixo interno para filtros numéricos por coluna (estilo Excel). */
export const NUM_FILTER_MARKER = '\u0002NUM\u0002';

export type NumericFilterOp = 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export const NUMERIC_FILTER_OPTIONS: { op: NumericFilterOp; label: string }[] = [
  { op: 'neq', label: 'É Diferente de...' },
  { op: 'gt', label: 'É Maior do que...' },
  { op: 'gte', label: 'É Maior ou Igual a...' },
  { op: 'lt', label: 'É Menor do que...' },
  { op: 'lte', label: 'É Menor ou Igual a...' },
  { op: 'between', label: 'Está Entre...' },
];

export function isNumericColumnFilter(value: string): boolean {
  return value.startsWith(NUM_FILTER_MARKER);
}

export function parseNumeroFiltroInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function encodeNumericColumnFilter(op: NumericFilterOp, v1: number, v2?: number): string {
  const parts = [NUM_FILTER_MARKER, op, String(v1)];
  if (op === 'between' && v2 != null && Number.isFinite(v2)) parts.push(String(v2));
  return parts.join('\u0003');
}

export function parseNumericColumnFilter(
  value: string
): { op: NumericFilterOp; v1: number; v2: number | null } | null {
  if (!isNumericColumnFilter(value)) return null;
  const parts = value.slice(NUM_FILTER_MARKER.length).split('\u0003');
  const op = parts[0] as NumericFilterOp;
  if (!NUMERIC_FILTER_OPTIONS.some((o) => o.op === op)) return null;
  const v1 = Number(parts[1]);
  if (!Number.isFinite(v1)) return null;
  const v2 = parts[2] != null && parts[2] !== '' ? Number(parts[2]) : null;
  if (op === 'between' && (v2 == null || !Number.isFinite(v2))) return null;
  return { op, v1, v2 };
}

export function parseCellTextAsNumber(cellText: string): number {
  const raw = (cellText ?? '').trim();
  if (!raw || raw === '—') return NaN;
  const forNum = raw.replace(/\s/g, '').replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.');
  const n = Number(forNum);
  return Number.isFinite(n) ? n : NaN;
}

export function matchesNumericColumnFilter(cellNum: number, filterValue: string): boolean {
  const spec = parseNumericColumnFilter(filterValue);
  if (!spec) return true;
  if (!Number.isFinite(cellNum)) return false;
  const { op, v1, v2 } = spec;
  switch (op) {
    case 'neq':
      return cellNum !== v1;
    case 'gt':
      return cellNum > v1;
    case 'gte':
      return cellNum >= v1;
    case 'lt':
      return cellNum < v1;
    case 'lte':
      return cellNum <= v1;
    case 'between':
      return v2 != null && cellNum >= Math.min(v1, v2) && cellNum <= Math.max(v1, v2);
    default:
      return true;
  }
}
