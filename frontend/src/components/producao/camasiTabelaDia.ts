/** Classes visuais para grade agrupada por dia (Camasi). */
export function classesBlocoDia(diaIndex: number, linhaNoDia: number, inicioBloco: boolean): {
  tr: string;
  dataTd: string;
} {
  const blocoA = diaIndex % 2 === 0;
  const linhaClara = linhaNoDia % 2 === 0;
  const fundoLinha = blocoA
    ? linhaClara
      ? 'bg-sky-50 dark:bg-sky-950/50'
      : 'bg-sky-100/90 dark:bg-sky-900/40'
    : linhaClara
      ? 'bg-amber-50 dark:bg-amber-950/45'
      : 'bg-amber-100/80 dark:bg-amber-900/35';
  const topo = inicioBloco
    ? 'border-t-[3px] border-slate-400 dark:border-slate-500'
    : 'border-t border-slate-200/90 dark:border-slate-700/80';
  const dataTd = blocoA
    ? 'bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50'
    : 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50';
  return { tr: `${fundoLinha} ${topo}`, dataTd };
}
