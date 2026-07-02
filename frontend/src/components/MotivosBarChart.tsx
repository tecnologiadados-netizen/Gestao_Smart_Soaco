interface MotivosBarChartProps {
  data: { motivo: string; quantidade: number }[];
  loading?: boolean;
}

const BAR_HEIGHT = 28;
const LABEL_MAX_W = 220;
const BAR_AREA_MIN_W = 200;

export default function MotivosBarChart({ data, loading }: MotivosBarChartProps) {
  if (loading) {
    return (
      <div className="bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl p-5 animate-pulse min-h-[200px]">
        <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/3 mb-4" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-full mb-3" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-4/5 mb-3" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-2/3" />
      </div>
    );
  }

  const hasData = data && data.length > 0;
  const max = hasData ? Math.max(...data.map((d) => d.quantidade), 1) : 1;
  const displayData = hasData ? data.slice(0, 15) : [];

  return (
    <div className="card-panel flex flex-col min-h-[220px]">
      <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white mb-4 shrink-0">
        Gráfico de barras — Motivos de alteração de pedidos
      </h3>
      {!hasData ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm flex-1 flex items-center justify-center">
          Nenhum motivo de alteração registrado. Os motivos aparecem aqui após ajustes de previsão.
        </p>
      ) : (
        <div className="flex flex-col gap-2" style={{ minWidth: 0 }}>
          {displayData.map((d, i) => {
            const pct = max > 0 ? (d.quantidade / max) * 100 : 0;
            const barWidthPct = Math.max(pct, 3);
            return (
              <div
                key={`motivo-${i}-${d.motivo}`}
                className="flex items-center gap-3"
                style={{ height: BAR_HEIGHT, minHeight: BAR_HEIGHT }}
                title={`${d.motivo}: ${d.quantidade}`}
              >
                <span
                  className="text-xs text-slate-600 dark:text-slate-400 shrink-0 truncate"
                  style={{ maxWidth: LABEL_MAX_W, minWidth: 80 }}
                >
                  {d.motivo || '(sem motivo)'}
                </span>
                <div
                  className="flex-1 flex items-center gap-2 h-full min-w-[200px]"
                  style={{ minWidth: BAR_AREA_MIN_W }}
                >
                  <div
                    className="h-4 rounded bg-primary-600 transition-all shrink-0"
                    style={{
                      width: `${barWidthPct}%`,
                      minWidth: 8,
                    }}
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">
                    {d.quantidade}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
