const nfMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarReais(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return nfMoney.format(v);
}

export function formatarPct(v: number | null | undefined, comSinal = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = `${nfPct.format(v)}%`;
  if (comSinal && v > 0) return `+${s}`;
  return s;
}

/** Abreviação para eixos/tooltips de gráfico (R$ 1,2M). */
export function formatarReaisCompacto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sinal = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sinal}R$ ${(abs / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}Bi`;
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mil`;
  return formatarReais(v);
}

export function rotuloPeriodoMes(periodo: string): string {
  const [y, m] = periodo.split('-');
  if (!y || !m) return periodo;
  return `${m}/${y}`;
}

/** Verde se melhora, vermelho se piora — `inverso` para CPV/despesas. */
export function corVariacao(pct: number | null | undefined, inverso = false): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) {
    return 'text-slate-400 dark:text-slate-500';
  }
  const bom = inverso ? pct < 0 : pct > 0;
  return bom ? 'text-emerald-700 dark:text-emerald-600' : 'text-red-700 dark:text-red-600';
}

export function setaVariacao(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return '→';
  return pct > 0 ? '↑' : '↓';
}
