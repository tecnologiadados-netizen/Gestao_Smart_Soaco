/**
 * Formata coluna DATE/DATETIME do SQL como YYYY-MM-DD (calendário, sem deslocar fuso).
 * Drivers (mssql/mysql) costumam devolver DATE como Date em UTC 00:00; getDate() local
 * no Brasil (UTC-3) resulta no dia anterior.
 */
export function formatSqlDateYmd(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : null;
}

/** Bucket de agregação SQL (DATE_FORMAT / período) quando o driver devolve Date. */
export function formatSqlDatePeriod(
  periodoRaw: unknown,
  granularidade: 'mes' | 'dia'
): string {
  if (periodoRaw instanceof Date) {
    const d = periodoRaw;
    if (Number.isNaN(d.getTime())) return '';
    if (granularidade === 'mes') {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return formatSqlDateYmd(d) ?? '';
  }
  if (granularidade === 'mes' && periodoRaw != null && String(periodoRaw).includes('-')) {
    return String(periodoRaw).slice(0, 7);
  }
  return String(periodoRaw ?? '').slice(0, 10);
}

function ymdFromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Projeção de receitas na DFC: sábado → próxima terça (+3); domingo → próxima terça (+2).
 */
export function ajustarDataProjVencFimSemana(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 3);
  else if (dow === 0) d.setDate(d.getDate() + 2);
  return ymdFromLocalDate(d);
}
