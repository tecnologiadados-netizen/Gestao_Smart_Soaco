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

/** Rótulo compacto para eixo de gráficos (ex.: ago/25). */
export function labelMesEixo(ym: string): string {
  const d = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const ano = String(d.getFullYear()).slice(-2);
  return `${mes}/${ano}`;
}

/** Converte YYYY-MM no intervalo completo do mês. */
export function mesParaPeriodoYmd(ym: string): { dataIni: string; dataFim: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  const last = new Date(y, mo, 0).getDate();
  return {
    dataIni: `${m[1]}-${m[2]}-01`,
    dataFim: `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`,
  };
}

/** Paleta clean para o painel comercial / histórico. */
export const PAINEL_PALETTE = {
  barras: [
    '#0ea5e9',
    '#14b8a6',
    '#22c55e',
    '#84cc16',
    '#eab308',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#ec4899',
    '#a855f7',
    '#6366f1',
    '#3b82f6',
    '#06b6d4',
  ],
  mix: ['#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#64748b'],
  grupos: '#3b82f6',
  vendedores: '#10b981',
  uf: '#f59e0b',
  subgrupo: '#06b6d4',
  ganhadores: '#10b981',
  perdedores: '#f43f5e',
} as const;


export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mesesAtrasYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Período máximo permitido (48 meses) — padrão “todo o histórico disponível” nos painéis comerciais. */
export const PAINEL_COMERCIAL_MAX_MESES = 48;

export function periodoDisponivelPadraoYmd(): { dataIni: string; dataFim: string } {
  return {
    dataIni: mesesAtrasYmd(PAINEL_COMERCIAL_MAX_MESES),
    dataFim: hojeYmd(),
  };
}

/** Início do mês corrente menos N meses fechados (1º dia). Ex.: N=3 em ago → 01/mai. */
export function inicioMesesFechadosMaisCorrenteYmd(mesesFechados: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesFechados);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Diferença em meses calendário entre duas datas YYYY-MM-DD (fim >= ini). */
export function mesesEntreYmd(dataIni: string, dataFim: string): number | null {
  const mIni = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataIni ?? '').trim());
  const mFim = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataFim ?? '').trim());
  if (!mIni || !mFim) return null;
  const y1 = Number(mIni[1]);
  const mo1 = Number(mIni[2]);
  const y2 = Number(mFim[1]);
  const mo2 = Number(mFim[2]);
  if (![y1, mo1, y2, mo2].every(Number.isFinite)) return null;
  const meses = (y2 - y1) * 12 + (mo2 - mo1);
  return meses < 0 ? null : meses;
}

export function formatYmdBr(ymd: string): string {
  const v = String(ymd ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return v || '—';
}

