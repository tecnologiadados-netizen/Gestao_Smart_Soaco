import type { DreDashboardKpi } from '../../../api/financeiro';
import { corVariacao, formatarPct, formatarReais, setaVariacao } from './dashboardFormat';

type Props = { kpis: DreDashboardKpi[]; loading?: boolean };

const CARD =
  'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm';

export default function DashboardKpiCards({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`${CARD} h-28 animate-pulse bg-slate-100 dark:bg-slate-800`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.id} className={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {k.label}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatarReais(k.valor)}
          </p>
          {k.pctFaturamento != null && k.id !== 'faturamento' ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatarPct(k.pctFaturamento)} do faturamento
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
            <span className={corVariacao(k.momPct, k.inverso)}>
              MoM {setaVariacao(k.momPct)} {formatarPct(k.momPct, true)}
            </span>
            <span className={corVariacao(k.yoyPct, k.inverso)}>
              YoY {setaVariacao(k.yoyPct)} {formatarPct(k.yoyPct, true)}
            </span>
          </div>
          {k.breakdown ? (
            <ul className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-2 text-xs text-slate-600 dark:text-slate-300">
              {(
                [
                  ['Operacional', k.breakdown.operacional],
                  ['Logística', k.breakdown.logistica],
                  ['Administrativo', k.breakdown.administrativo],
                ] as const
              ).map(([nome, b]) => (
                <li key={nome} className="flex justify-between gap-2 tabular-nums">
                  <span>{nome}</span>
                  <span>
                    {formatarReais(b.valor)}
                    {b.pctTotal != null ? (
                      <span className="text-slate-400 ml-1">({formatarPct(b.pctTotal)})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
