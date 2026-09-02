import type { Resumo } from '../../api/pedidos';
import { formatMoedaDash, formatNumero } from './dashEntregasUtils';

export type KpiDrillKey =
  | 'total'
  | 'atrasado'
  | 'em_dia'
  | 'entrega_hoje'
  | 'lead_time';

type Props = {
  resumo: Resumo | null;
  loading?: boolean;
  onDrill: (key: KpiDrillKey) => void;
};

type KpiItem = {
  key: KpiDrillKey;
  label: string;
  valor: string;
  sub: string;
  accent: string;
  border: string;
  topColor: string;
  destaque?: boolean;
};

export default function DashEntregasKpiCards({ resumo, loading, onDrill }: Props) {
  if (loading || !resumo) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
        ))}
      </div>
    );
  }

  const totalValor = resumo.totalValorPendenteReal ?? 0;
  const atrasadoValor = resumo.atrasadosValorPendenteReal ?? 0;
  const emDiaValor = resumo.emDiaValorPendenteReal ?? Math.max(0, totalValor - atrasadoValor);
  const pctAtrasado = resumo.pctAtrasadoValor ?? (totalValor > 0 ? Math.round((atrasadoValor / totalValor) * 100) : 0);
  const pctEmDia = 100 - pctAtrasado;
  const entregaHojeValor = resumo.entregaHojeValorPendenteReal ?? 0;

  const totalPedidos = resumo.totalPedidos ?? resumo.total;
  const atrasadosPedidos = resumo.atrasadosPedidos ?? resumo.atrasados;
  const emDiaPedidos = resumo.emDiaPedidos ?? resumo.emDia ?? resumo.total - resumo.atrasados;
  const entregaHojePedidos = resumo.entregaHojePedidos ?? resumo.entregaHoje;

  const cards: KpiItem[] = [
    {
      key: 'total',
      label: 'Saldo pendente total',
      valor: formatMoedaDash(totalValor, true),
      sub: `${formatNumero(totalPedidos)} pedidos em aberto`,
      accent: 'text-sky-600 dark:text-sky-400',
      border: 'border-sky-500/20 hover:border-sky-500/50',
      topColor: '#0ea5e9',
      destaque: true,
    },
    {
      key: 'atrasado',
      label: 'Saldo atrasado',
      valor: formatMoedaDash(atrasadoValor, true),
      sub: `${pctAtrasado}% do saldo · ${formatNumero(atrasadosPedidos)} pedidos`,
      accent: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/25 hover:border-amber-500/60',
      topColor: '#f59e0b',
    },
    {
      key: 'em_dia',
      label: 'Saldo em dia',
      valor: formatMoedaDash(emDiaValor, true),
      sub: `${pctEmDia}% do saldo · ${formatNumero(emDiaPedidos)} pedidos`,
      accent: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/25 hover:border-emerald-500/60',
      topColor: '#22c55e',
    },
    {
      key: 'entrega_hoje',
      label: 'Entrega hoje',
      valor: formatMoedaDash(entregaHojeValor, true),
      sub: `${formatNumero(entregaHojePedidos)} pedidos com previsão hoje`,
      accent: 'text-violet-600 dark:text-violet-400',
      border: 'border-violet-500/25 hover:border-violet-500/60',
      topColor: '#8b5cf6',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onDrill(c.key)}
            className={`group rounded-2xl border border-t-4 bg-white/80 p-5 text-left shadow-sm transition-all hover:shadow-md dark:bg-slate-900/80 ${c.border} ${
              c.destaque ? 'ring-1 ring-sky-500/10' : ''
            }`}
            style={{ borderTopColor: c.topColor }}
            title="Clique para ver os pedidos de origem"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {c.label}
            </p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${c.accent}`}>{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.sub}</p>
            <p className="mt-3 text-[11px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500">
              Ver detalhes →
            </p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onDrill('lead_time')}
        className="flex w-full items-center justify-between rounded-xl border border-t-4 border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600"
        style={{ borderTopColor: '#6366f1' }}
        title="Clique para ver saldo por TipoF"
      >
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Lead time médio (dias até a previsão original)
        </span>
        <span className="text-lg font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
          {resumo.leadTimeMedioDias ?? '—'}
        </span>
      </button>
    </div>
  );
}
