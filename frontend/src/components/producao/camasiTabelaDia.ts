/** Classes visuais para grade agrupada por dia (Camasi) — zebra suave + faixa lateral. */
export function classesBlocoDia(diaIndex: number, linhaNoDia: number, inicioBloco: boolean): {
  tr: string;
  dataTd: string;
} {
  const blocoA = diaIndex % 2 === 0;
  const linhaClara = linhaNoDia % 2 === 0;

  const fundoLinha = blocoA
    ? linhaClara
      ? 'bg-white dark:bg-slate-900/80'
      : 'bg-slate-50/90 dark:bg-slate-800/50'
    : linhaClara
      ? 'bg-slate-50/70 dark:bg-slate-800/35'
      : 'bg-slate-100/60 dark:bg-slate-800/70';

  const faixa = blocoA
    ? 'border-l-[3px] border-l-slate-300 dark:border-l-slate-500'
    : 'border-l-[3px] border-l-slate-400/80 dark:border-l-slate-400/50';

  const topo = inicioBloco
    ? 'border-t border-slate-300 dark:border-t-slate-600'
    : 'border-t border-slate-100 dark:border-t-slate-800/80';

  const dataTd = blocoA
    ? 'bg-slate-100/90 text-slate-800 dark:bg-slate-800/90 dark:text-slate-100'
    : 'bg-slate-200/70 text-slate-800 dark:bg-slate-700/80 dark:text-slate-100';

  return { tr: `${fundoLinha} ${faixa} ${topo}`, dataTd };
}
