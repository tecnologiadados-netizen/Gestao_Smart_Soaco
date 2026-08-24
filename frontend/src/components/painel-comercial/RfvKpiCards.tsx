import { formatMoeda, formatNumero } from './painelComercialUtils';

export default function RfvKpiCards({
  resumo,
  loading,
}: {
  resumo: { totalClientes: number; faturamentoPeriodo: number } | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 xl:w-44">
        {[1, 2].map((i) => (
          <div key={i} className="min-h-[88px] animate-pulse rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-6 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (!resumo) return null;

  return (
    <div className="flex flex-row gap-2 xl:flex-col xl:gap-2">
      <div className="min-h-[88px] flex-1 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60 xl:flex-none">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Faturamento no período</p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{formatMoeda(resumo.faturamentoPeriodo, true)}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatMoeda(resumo.faturamentoPeriodo)}</p>
      </div>
      <div className="min-h-[88px] flex-1 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60 xl:flex-none">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total clientes</p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{formatNumero(resumo.totalClientes)}</p>
      </div>
    </div>
  );
}
