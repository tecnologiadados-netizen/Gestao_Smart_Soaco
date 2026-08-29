import { useMemo, type MouseEvent } from 'react';
import MetricToggle from './MetricToggle';
import type { MetricaPainel } from './metricaPainel';
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
  subtitle = 'Clique para detalhar · Ctrl+clique para filtrar.',
  rows,
  loading,
  onRowClick,
  maxItems = 12,
  metrica = 'valor',
  onMetricaChange,
  accentColor = '#3b82f6',
}: {
  title: string;
  subtitle?: string;
  rows: RankingRow[];
  loading?: boolean;
  onRowClick: (row: RankingRow, e: MouseEvent) => void;
  maxItems?: number;
  metrica?: MetricaPainel;
  onMetricaChange?: (v: MetricaPainel) => void;
  accentColor?: string;
}) {
  const display = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      metrica === 'qtde' ? b.qtde - a.qtde : b.valor - a.valor
    );
    return sorted.slice(0, maxItems);
  }, [rows, maxItems, metrica]);

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

  const maxMetric = Math.max(...display.map((d) => (metrica === 'qtde' ? d.qtde : d.valor)), 1);

  if (!display.length) {
    return (
      <div className="card-panel flex min-h-[380px] items-center justify-center p-5 text-slate-500">
        Sem dados.
      </div>
    );
  }

  return (
    <div
      className="card-panel flex min-h-[380px] flex-col border-t-4 p-5"
      style={{ borderTopColor: accentColor }}
    >
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        {onMetricaChange ? <MetricToggle value={metrica} onChange={onMetricaChange} /> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {display.map((d) => {
          const metricVal = metrica === 'qtde' ? d.qtde : d.valor;
          const pctBar = (metricVal / maxMetric) * 100;
          const labelPrincipal =
            metrica === 'qtde' ? `${formatNumero(d.qtde)} un.` : formatMoeda(d.valor, true);
          return (
            <div key={d.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3">
              <button
                type="button"
                onClick={(e) => onRowClick(d, e)}
                className="truncate text-left text-xs font-medium text-slate-700 hover:opacity-80 dark:text-slate-200"
                style={{ color: undefined }}
                title={`Venda: ${formatMoeda(d.valor)}\nQtde: ${formatNumero(d.qtde)}\nPedidos: ${formatNumero(d.pedidos)}\nClique para detalhar`}
              >
                {d.label}
              </button>
              <button
                type="button"
                onClick={(e) => onRowClick(d, e)}
                className="group relative h-8 overflow-hidden rounded-lg bg-slate-100 text-left dark:bg-slate-800"
                title={`Venda: ${formatMoeda(d.valor)}\nQtde: ${formatNumero(d.qtde)}\nPedidos: ${formatNumero(d.pedidos)}\nClique para detalhar`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all group-hover:brightness-110"
                  style={{
                    width: `${Math.max(pctBar, metricVal > 0 ? 2 : 0)}%`,
                    backgroundColor: accentColor,
                    opacity: 0.85,
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                  {labelPrincipal}
                </span>
              </button>
              <div className="min-w-[130px] text-right">
                <button
                  type="button"
                  onClick={(e) => onRowClick(d, e)}
                  className="text-xs font-semibold tabular-nums text-slate-700 hover:opacity-80 dark:text-slate-200"
                >
                  {labelPrincipal}
                </button>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {metrica === 'qtde' ? formatMoeda(d.valor, true) : `${formatNumero(d.qtde)} un.`}
                  {metrica === 'valor' && d.valorVarPct !== undefined && (
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
