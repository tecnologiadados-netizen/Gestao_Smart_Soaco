/** Análise vertical: participação sobre a Receita Bruta do mesmo período (%). */
export function calcularAnaliseVertical(valor: number, receitaBruta: number): number | null {
  if (!Number.isFinite(valor) || !Number.isFinite(receitaBruta) || receitaBruta === 0) return null;
  return (valor / receitaBruta) * 100;
}

/** Análise horizontal: variação vs. período anterior (%). */
export function calcularAnaliseHorizontal(valorAtual: number, valorAnterior: number): number | null {
  if (!Number.isFinite(valorAtual) || !Number.isFinite(valorAnterior) || valorAnterior === 0) {
    return null;
  }
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

const nfPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarAnalisePct(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return `${nfPct.format(valor)}%`;
}

export function corAnaliseHorizontal(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor) || valor === 0) {
    return 'text-black/40 dark:text-black/40';
  }
  return valor > 0 ? 'text-emerald-700 dark:text-emerald-700' : 'text-red-700 dark:text-red-700';
}
