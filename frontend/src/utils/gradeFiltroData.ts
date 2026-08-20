/** Prefixo interno para filtro de intervalo de datas (início/fim). */
export const DATE_FILTER_MARKER = '\u0002DATE\u0002';

const SEP = '\u0003';

export function isDateRangeFilter(value: string): boolean {
  return value.startsWith(DATE_FILTER_MARKER);
}

/** Normaliza para YYYY-MM-DD ou null. */
export function cellToYmd(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s || s === '—') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (br) {
    const dd = br[1]!.padStart(2, '0');
    const mm = br[2]!.padStart(2, '0');
    let yyyy = Number(br[3]);
    if (yyyy < 100) yyyy += 2000;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export function encodeDateRangeFilter(fromYmd: string, toYmd: string): string {
  return [DATE_FILTER_MARKER, fromYmd.trim(), toYmd.trim()].join(SEP);
}

export function parseDateRangeFilter(value: string): { from: string; to: string } | null {
  if (!isDateRangeFilter(value)) return null;
  const parts = value.slice(DATE_FILTER_MARKER.length).split(SEP);
  return { from: parts[1] ?? '', to: parts[2] ?? '' };
}

export function matchesDateRangeFilter(cellYmd: string | null, filterValue: string): boolean {
  const spec = parseDateRangeFilter(filterValue);
  if (!spec) return true;
  if (!cellYmd) return false;
  let from = spec.from;
  let to = spec.to;
  if (from && to && from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  if (from && cellYmd < from) return false;
  if (to && cellYmd > to) return false;
  return true;
}
