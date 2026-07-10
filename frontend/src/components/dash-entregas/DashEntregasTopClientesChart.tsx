import type { ClienteAtrasadoResumo } from '../../api/pedidos';
import { formatMoedaDash, formatNumero } from './dashEntregasUtils';

type Props = {
  data: ClienteAtrasadoResumo[];
  loading?: boolean;
  onClienteClick: (cliente: ClienteAtrasadoResumo) => void;
};

export default function DashEntregasTopClientesChart({ data, loading, onClienteClick }: Props) {
  if (loading) {
    return (
      <div className="card-panel min-h-[320px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card-panel flex min-h-[320px] items-center justify-center p-5 text-slate-500">
        Nenhum cliente com saldo atrasado.
      </div>
    );
  }

  const maxValor = Math.max(...data.map((d) => d.valorAtrasado), 1);

  return (
    <div className="card-panel flex min-h-[320px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
          Maiores exposições financeiras em atraso
        </h3>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {data.map((d, idx) => {
          const pct = (d.valorAtrasado / maxValor) * 100;
          return (
            <button
              key={d.cliente}
              type="button"
              onClick={() => onClienteClick(d)}
              className="group grid w-full grid-cols-[24px_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              title="Clique para ver os pedidos deste cliente"
            >
              <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
              <span className="truncate text-xs font-medium text-slate-700 group-hover:text-primary-600 dark:text-slate-200">
                {d.cliente}
              </span>
              <div className="relative h-6 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-amber-500/80 transition group-hover:bg-amber-500"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="min-w-[88px] text-right text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                {formatMoedaDash(d.valorAtrasado, true)}
                <span className="block text-[10px] font-normal text-slate-500">
                  {formatNumero(d.quantidade)} itens
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
