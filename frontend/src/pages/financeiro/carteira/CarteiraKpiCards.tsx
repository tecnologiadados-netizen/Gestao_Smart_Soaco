import type { CarteiraFinanceiraResumo } from '../../../api/financeiro';
import { formatarPct, formatarReais } from '../dashboard/dashboardFormat';

type Props = { resumo: CarteiraFinanceiraResumo; loading?: boolean };

function CardPrincipal({
  label,
  valor,
  pedidos,
  loading,
  tema,
}: {
  label: string;
  valor: number;
  pedidos: number;
  loading?: boolean;
  tema: string;
}) {
  if (loading) {
    return (
      <div className="card-kpi animate-pulse">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-600 rounded mb-3" />
        <div className="h-7 w-36 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
      </div>
    );
  }
  return (
    <div className="card-kpi">
      <div className="card-kpi-label flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${tema}`} />
        {label}
      </div>
      <div className="card-kpi-value">{formatarReais(valor)}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        {pedidos.toLocaleString('pt-BR')} pedidos
      </div>
    </div>
  );
}

export default function CarteiraKpiCards({ resumo, loading }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardPrincipal
          label="Saldo a Receber"
          valor={resumo.saldoAReceber}
          pedidos={resumo.totalPedidos}
          loading={loading}
          tema="bg-teal-500"
        />
        <CardPrincipal
          label="Saldo a Faturar"
          valor={resumo.saldoAFaturar}
          pedidos={resumo.totalPedidos}
          loading={loading}
          tema="bg-amber-500"
        />
        <CardPrincipal
          label="Saldo Romaneado"
          valor={resumo.saldoRomaneado}
          pedidos={resumo.totalPedidos}
          loading={loading}
          tema="bg-indigo-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="card-panel px-4 py-3 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-600 rounded" />
            </div>
          ))
        ) : (
          <>
            <div className="card-panel px-4 py-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Total de Pedidos</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {resumo.totalPedidos.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="card-panel px-4 py-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Pedidos Atrasados</div>
              <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">
                {resumo.pedidosAtrasados.toLocaleString('pt-BR')}
                <span className="text-sm font-normal text-slate-500 ml-2">
                  ({formatarPct(resumo.pctAtrasados)})
                </span>
              </div>
            </div>
            <div className="card-panel px-4 py-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Ticket Médio</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {formatarReais(resumo.ticketMedio)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
