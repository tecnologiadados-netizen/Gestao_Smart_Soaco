import type { ObservacaoValorResumo } from '../../api/pedidos';
import { formatMoedaDash, formatNumero } from './dashEntregasUtils';

type Props = {
  data: ObservacaoValorResumo[];
  loading?: boolean;
  onRotaClick: (rota: ObservacaoValorResumo, tipo: 'total' | 'atrasado' | 'em_dia') => void;
};

export default function DashEntregasRotasChart({ data, loading, onRotaClick }: Props) {
  if (loading) {
    return (
      <div className="card-panel min-h-[420px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  const display = data.slice(0, 12);
  const maxValor = Math.max(...display.map((d) => d.valorTotal), 1);

  if (!display.length) {
    return (
      <div className="card-panel flex min-h-[420px] items-center justify-center p-5 text-slate-500">
        Sem dados de rotas.
      </div>
    );
  }

  return (
    <div className="card-panel flex min-h-[420px] flex-col p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
          Saldo pendente por rota
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> Atrasado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Em dia
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {display.map((d) => {
          const pctTotal = (d.valorTotal / maxValor) * 100;
          const pctAtrasado = d.valorTotal > 0 ? Math.round((d.valorAtrasado / d.valorTotal) * 100) : 0;
          const pctEmDia = d.valorTotal > 0 ? 100 - pctAtrasado : 0;
          const pctAtrasadoBar = (pctTotal * pctAtrasado) / 100;
          const pctEmDiaBar = (pctTotal * pctEmDia) / 100;

          return (
            <div key={d.observacao} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3">
              <button
                type="button"
                onClick={() => onRotaClick(d, 'total')}
                className="truncate text-left text-xs font-medium text-slate-700 hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-400"
                title={d.observacao}
              >
                {d.observacao}
              </button>
              <div className="relative flex h-8 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {d.valorAtrasado > 0 && (
                  <button
                    type="button"
                    onClick={() => onRotaClick(d, 'atrasado')}
                    className="relative flex h-full items-center justify-center overflow-hidden bg-amber-500 text-[10px] font-semibold text-amber-950 transition hover:brightness-110"
                    style={{ width: `${Math.max(pctAtrasadoBar, 1)}%` }}
                    title={`Atrasado: ${formatMoedaDash(d.valorAtrasado)} (${pctAtrasado}%)`}
                  >
                    {pctAtrasadoBar >= 14 ? `${pctAtrasado}%` : ''}
                  </button>
                )}
                {d.valorEmDia > 0 && (
                  <button
                    type="button"
                    onClick={() => onRotaClick(d, 'em_dia')}
                    className="relative flex h-full items-center justify-center overflow-hidden bg-emerald-500 text-[10px] font-semibold text-emerald-950 transition hover:brightness-110"
                    style={{ width: `${Math.max(pctEmDiaBar, d.valorEmDia > 0 ? 1 : 0)}%` }}
                    title={`Em dia: ${formatMoedaDash(d.valorEmDia)} (${pctEmDia}%)`}
                  >
                    {pctEmDiaBar >= 14 ? `${pctEmDia}%` : ''}
                  </button>
                )}
              </div>
              <div className="min-w-[100px] text-right">
                <button
                  type="button"
                  onClick={() => onRotaClick(d, 'total')}
                  className="text-xs font-semibold tabular-nums text-slate-700 hover:text-primary-600 dark:text-slate-200"
                >
                  {formatMoedaDash(d.valorTotal, true)}
                </button>
                <p className="text-[10px] text-slate-500">
                  {formatNumero(d.quantidade)} it · {d.quantidadeAtrasada} atr.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
