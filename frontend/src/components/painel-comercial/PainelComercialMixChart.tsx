import { formatMoeda } from './painelComercialUtils';

export default function PainelComercialMixChart({
  data,
  loading,
  onSliceClick,
}: {
  data: { grupoProduto: string; valor: number; pct: number }[];
  loading?: boolean;
  onSliceClick: (grupoProduto: string) => void;
}) {
  if (loading) {
    return (
      <div className="card-panel min-h-[380px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[280px] rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card-panel flex min-h-[380px] items-center justify-center p-5 text-slate-500">
        Sem dados de mix.
      </div>
    );
  }

  const total = data.reduce((s, x) => s + x.valor, 0);
  const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#94a3b8'];

  let acc = 0;
  const slices = data.map((d, idx) => {
    const pct = total > 0 ? d.valor / total : 0;
    const start = acc;
    acc += pct;
    return { ...d, start, end: acc, color: colors[idx % colors.length] };
  });

  const R = 52;
  const C = 60;

  function polarToXY(t: number): { x: number; y: number } {
    const a = t * Math.PI * 2 - Math.PI / 2;
    return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
  }

  function arcPath(start: number, end: number): string {
    const p1 = polarToXY(start);
    const p2 = polarToXY(end);
    const large = end - start > 0.5 ? 1 : 0;
    return `M ${C} ${C} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
  }

  return (
    <div className="card-panel flex min-h-[380px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">Mix por grupo</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Participação no valor vendido. Clique para detalhar.</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
        <div className="flex items-center justify-center">
          <svg width={120} height={120} viewBox="0 0 120 120">
            {slices.map((s) => (
              <path
                key={s.grupoProduto}
                d={arcPath(s.start, s.end)}
                fill={s.color}
                opacity={0.92}
                className="cursor-pointer hover:opacity-100"
                onClick={() => onSliceClick(s.grupoProduto)}
              >
                <title>{`${s.grupoProduto}\n${s.pct.toFixed(1)}%\n${formatMoeda(s.valor)}`}</title>
              </path>
            ))}
            <circle cx={60} cy={60} r={26} fill="var(--tw-prose-body)" opacity={0.06} />
          </svg>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="space-y-2">
            {data.map((d, idx) => (
              <button
                key={d.grupoProduto}
                type="button"
                onClick={() => onSliceClick(d.grupoProduto)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                title="Clique para detalhar"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
                  <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{d.grupoProduto}</span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {d.pct.toFixed(1)}% · {formatMoeda(d.valor, true)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

