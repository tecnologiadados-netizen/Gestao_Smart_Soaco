export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoeda(v: number, compact?: boolean): string {
  if (!Number.isFinite(v)) return '—';
  if (!compact) return brl.format(v);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${brl.format(v / 1_000_000)} mi`.replace('R$', 'R$');
  if (abs >= 1_000) return `${brl.format(v / 1_000)} mil`.replace('R$', 'R$');
  return brl.format(v);
}

export function formatNumero(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR').format(v);
}

export function formatPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export function classVar(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return 'text-slate-600 dark:text-slate-300';
  if (v > 0) return 'text-emerald-700 dark:text-emerald-300';
  return 'text-rose-700 dark:text-rose-300';
}

export function labelMesCurto(ym: string): string {
  const d = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
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

export function formatYmdBr(ymd: string): string {
  const v = String(ymd ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

