import type { AgingFaixaResumo } from '../../api/pedidos';
import { formatMoedaDash, formatNumero } from './dashEntregasUtils';

type Props = {
  data: AgingFaixaResumo[];
  loading?: boolean;
  onFaixaClick: (faixa: AgingFaixaResumo) => void;
};

const CORES: Record<string, string> = {
  em_dia: 'bg-emerald-500',
  atraso_1_7: 'bg-sky-500',
  atraso_8_15: 'bg-blue-500',
  atraso_16_30: 'bg-indigo-500',
  atraso_31_60: 'bg-amber-500',
  atraso_60_mais: 'bg-red-500',
};

export default function DashEntregasAgingChart({ data, loading, onFaixaClick }: Props) {
  if (loading) {
    return (
      <div className="card-panel min-h-[340px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card-panel flex min-h-[340px] items-center justify-center p-5 text-slate-500">
        Sem dados de aging.
      </div>
    );
  }

  const maxValor = Math.max(...data.map((d) => d.valor), 1);
  const totalValor = data.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="card-panel flex min-h-[340px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
          Aging do saldo pendente
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Distribuição por faixa de atraso (valor real)
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {data.map((d) => {
          const pctBar = (d.valor / maxValor) * 100;
          const pctTotal = totalValor > 0 ? Math.round((d.valor / totalValor) * 100) : 0;
          const cor = CORES[d.faixa] ?? 'bg-slate-500';
          return (
            <button
              key={d.faixa}
              type="button"
              onClick={() => onFaixaClick(d)}
              className="group grid w-full grid-cols-[100px_1fr_auto] items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              title="Clique para ver os pedidos desta faixa"
            >
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{d.label}</span>
              <div className="relative h-7 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                <div
                  className={`absolute inset-y-0 left-0 rounded-md ${cor} transition-all group-hover:brightness-110`}
                  style={{ width: `${Math.max(pctBar, d.valor > 0 ? 2 : 0)}%` }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {formatMoedaDash(d.valor, true)}
                </span>
              </div>
              <span className="min-w-[72px] text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {pctTotal}% · {formatNumero(d.quantidade)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
