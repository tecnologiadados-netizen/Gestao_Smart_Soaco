import { formatMoeda, formatNumero, formatPct, classVar } from './painelComercialUtils';

export type KpiKey = 'valor' | 'qtde' | 'ticket' | 'pedidos' | 'concentracao';

export default function PainelComercialKpiCards({
  kpis,
  loading,
  onKpiClick,
}: {
  kpis: {
    valor: number;
    valorVarPct: number | null;
    qtde: number;
    qtdeVarPct: number | null;
    ticketMedio: number;
    ticketMedioVarPct: number | null;
    pedidos: number;
    pedidosVarPct: number | null;
    concentracaoTopGrupoPct: number;
  } | null;
  loading?: boolean;
  onKpiClick: (key: KpiKey) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card-panel h-[110px] animate-pulse p-4">
            <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-7 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const cards: Array<{
    key: KpiKey;
    title: string;
    value: string;
    sub: string;
    varPct?: number | null;
  }> = [
    { key: 'valor', title: 'Valor vendido', value: formatMoeda(kpis.valor, true), sub: formatMoeda(kpis.valor), varPct: kpis.valorVarPct },
    { key: 'qtde', title: 'Qtde vendida', value: formatNumero(kpis.qtde), sub: 'Unidades ajustadas', varPct: kpis.qtdeVarPct },
    { key: 'ticket', title: 'Ticket médio', value: formatMoeda(kpis.ticketMedio, true), sub: 'Valor médio por PD', varPct: kpis.ticketMedioVarPct },
    { key: 'pedidos', title: 'Pedidos', value: formatNumero(kpis.pedidos), sub: 'PDs distintos', varPct: kpis.pedidosVarPct },
    {
      key: 'concentracao',
      title: 'Concentração',
      value: `${kpis.concentracaoTopGrupoPct.toFixed(1)}%`,
      sub: 'Participação do top grupo',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onKpiClick(c.key)}
          className="card-panel group p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
          title="Clique para detalhar"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.title}</p>
            {c.varPct !== undefined && (
              <span className={`text-xs font-semibold tabular-nums ${classVar(c.varPct)}`}>{formatPct(c.varPct)}</span>
            )}
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">{c.value}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{c.sub}</p>
        </button>
      ))}
    </div>
  );
}

