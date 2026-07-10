import { formatMoeda, formatNumero, formatPct, classVar } from './painelComercialUtils';

export type RankingRow = {
  key: string;
  label: string;
  valor: number;
  qtde: number;
  pedidos: number;
  valorVarPct?: number | null;
};

export default function PainelComercialBarRanking({
  title,
  subtitle,
  rows,
  loading,
  onRowClick,
  maxItems = 12,
}: {
  title: string;
  subtitle: string;
  rows: RankingRow[];
  loading?: boolean;
  onRowClick: (row: RankingRow) => void;
  maxItems?: number;
}) {
  if (loading) {
    return (
      <div className="card-panel min-h-[380px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  const display = rows.slice(0, maxItems);
  const maxValor = Math.max(...display.map((d) => d.valor), 1);

  if (!display.length) {
    return (
      <div className="card-panel flex min-h-[380px] items-center justify-center p-5 text-slate-500">
        Sem dados.
      </div>
    );
  }

  return (
    <div className="card-panel flex min-h-[380px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {display.map((d) => {
          const pctBar = (d.valor / maxValor) * 100;
          return (
            <div key={d.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3">
              <button
                type="button"
                onClick={() => onRowClick(d)}
                className="truncate text-left text-xs font-medium text-slate-700 hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-400"
                title={d.label}
              >
                {d.label}
              </button>
              <button
                type="button"
                onClick={() => onRowClick(d)}
                className="group relative h-8 overflow-hidden rounded-lg bg-slate-100 text-left dark:bg-slate-800"
                title={`Valor: ${formatMoeda(d.valor)} · Qtde: ${formatNumero(d.qtde)} · PDs: ${formatNumero(d.pedidos)}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-primary-500/80 transition-all group-hover:brightness-110 dark:bg-primary-400/70"
                  style={{ width: `${Math.max(pctBar, d.valor > 0 ? 2 : 0)}%` }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                  {formatMoeda(d.valor, true)}
                </span>
              </button>
              <div className="min-w-[130px] text-right">
                <button
                  type="button"
                  onClick={() => onRowClick(d)}
                  className="text-xs font-semibold tabular-nums text-slate-700 hover:text-primary-600 dark:text-slate-200"
                >
                  {formatMoeda(d.valor, true)}
                </button>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {formatNumero(d.pedidos)} PDs · {formatNumero(d.qtde)} un.
                  {d.valorVarPct !== undefined && (
                    <>
                      {' '}
                      · <span className={`font-semibold ${classVar(d.valorVarPct)}`}>{formatPct(d.valorVarPct)}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

