export function formatHoras(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v)} h`;
}

export function formatYmdBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return ymd || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mesesAtrasYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primeiro dia do mês corrente. */
export function inicioMesAtualYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
