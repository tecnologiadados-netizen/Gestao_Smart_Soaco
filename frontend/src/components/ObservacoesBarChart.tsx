interface ObservacoesBarChartProps {
  data: { observacao: string; quantidade: number }[];
  loading?: boolean;
}

export default function ObservacoesBarChart({ data, loading }: ObservacoesBarChartProps) {
  if (loading) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-4" />
        <div className="h-3 bg-slate-700 rounded w-full mb-2" />
        <div className="h-3 bg-slate-700 rounded w-5/6 mb-2" />
        <div className="h-3 bg-slate-700 rounded w-2/3" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 text-slate-400">
        Sem dados de observações.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.quantidade), 1);

  return (
    <div className="card-panel dark:bg-soaco-graphite/90">
      <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white mb-4">
        Gráfico de barras — Pedidos por Observações
      </h3>
      <div className="space-y-2">
        {data.map((d) => {
          const pct = Math.round((d.quantidade / max) * 100);
          return (
            <div key={d.observacao} className="flex items-center gap-3">
              <div className="w-64 text-xs text-slate-300 truncate shrink-0" title={d.observacao}>
                {d.observacao}
              </div>
              <div className="flex-1 min-w-0 h-6 bg-soaco-gray/20 dark:bg-soaco-navy/50 rounded flex items-center">
                <div
                  className="h-6 rounded-l bg-primary-600 dark:bg-accent-500 shrink-0 transition-all"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <div className="w-10 text-right text-xs text-slate-300 shrink-0">{d.quantidade}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
