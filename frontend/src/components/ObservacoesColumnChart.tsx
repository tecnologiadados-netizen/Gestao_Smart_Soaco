interface ObservacoesColumnChartProps {
  data: { observacao: string; quantidade: number }[];
  loading?: boolean;
  /** Rota atualmente selecionada (para filtrar o gráfico de rosca). Clique na mesma coluna para limpar. */
  selectedRota?: string | null;
  onColumnClick?: (observacao: string | null) => void;
}

export default function ObservacoesColumnChart({ data, loading, selectedRota, onColumnClick }: ObservacoesColumnChartProps) {
  if (loading) {
    return (
      <div className="bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl p-5 animate-pulse h-[320px]">
        <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/3 mb-4" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-full mb-2" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-5/6 mb-2" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-2/3" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl p-5 text-slate-500 dark:text-slate-400 h-[320px] flex items-center justify-center">
        Sem dados de rotas.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.quantidade), 1);
  const displayData = data.slice(0, 12);
  const barAreaHeight = 200;

  return (
    <div className="card-panel min-h-[320px] flex flex-col">
      <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white mb-8 shrink-0">
        Gráfico de colunas — Pedidos por Rota
      </h3>
      <div
        className="flex gap-1 shrink-0 w-full"
        style={{ height: barAreaHeight }}
      >
        {displayData.map((d) => {
          const pct = max > 0 ? (d.quantidade / max) * 100 : 0;
          const barHeightPx = Math.max((pct / 100) * barAreaHeight, 4);
          const isSelected = selectedRota != null && d.observacao === selectedRota;
          const handleClick = () => {
            if (!onColumnClick) return;
            onColumnClick(isSelected ? null : d.observacao);
          };
          return (
            <div
              key={d.observacao}
              className={`flex-1 flex flex-col items-center justify-end min-w-0 ${onColumnClick ? 'cursor-pointer' : ''}`}
              title={onColumnClick ? `Clique para ver atrasados/em dia desta rota${isSelected ? ' (clique de novo para limpar)' : ''}` : `${d.observacao}: ${d.quantidade}`}
              onClick={onColumnClick ? handleClick : undefined}
              onKeyDown={onColumnClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
              role={onColumnClick ? 'button' : undefined}
              tabIndex={onColumnClick ? 0 : undefined}
            >
              <div
                className="flex flex-col justify-end items-center w-full shrink-0"
                style={{ height: barAreaHeight }}
              >
                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 mb-0.5 shrink-0">
                  {d.quantidade}
                </span>
                <div
                  className={`w-full rounded-t transition-all shrink-0 ${isSelected ? 'bg-primary-700 dark:bg-primary-500 ring-2 ring-primary-500 dark:ring-primary-400 ring-offset-2 dark:ring-offset-slate-800' : 'bg-primary-600'}`}
                  style={{ height: barHeightPx }}
                />
              </div>
              <span className={`text-[10px] truncate w-full text-center max-w-[70px] mt-1.5 shrink-0 ${isSelected ? 'text-primary-700 dark:text-primary-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                {d.observacao || '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
