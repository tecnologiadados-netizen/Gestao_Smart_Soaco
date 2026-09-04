import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoeda, formatPct, PAINEL_PALETTE } from '../painel-comercial/painelComercialUtils';

export type ParetoClienteRow = {
  key: string;
  label: string;
  valor: number;
  sharePct: number;
  acumuladoPct: number;
  pedidos: number;
};

type Props = {
  rows: ParetoClienteRow[];
  loading?: boolean;
  onBarClick?: (row: ParetoClienteRow) => void;
};

const H = 304;
const PAD_L = 58;
const PAD_R = 52;
const PAD_T = 30;
const PAD_B = 92;

/** Pareto clássico: barras de valor + linha de acumulado %. */
export default function ComissionamentoParetoClientes({ rows, loading, onBarClick }: Props) {
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const display = useMemo(() => rows.slice(0, 20), [rows]);

  useEffect(() => {
    if (loading || display.length === 0) return;
    const el = chartWrapRef.current;
    if (!el) return;

    const syncWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setW(Math.max(520, Math.floor(w)));
    };

    syncWidth();
    const ro = new ResizeObserver(() => syncWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, display.length]);

  const chart = useMemo(() => {
    const maxValor = Math.max(1, ...display.map((r) => r.valor));
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const n = display.length;
    const gap = n > 1 ? Math.min(5, innerW / n / 5) : 0;
    const barW = Math.max(6, (innerW - gap * (n - 1)) / Math.max(n, 1));
    const labelY = PAD_T + innerH + 12;

    const bars = display.map((r, i) => {
      const h = (r.valor / maxValor) * innerH;
      const x = PAD_L + i * (barW + gap);
      const y = PAD_T + innerH - h;
      const lineY = PAD_T + innerH - (r.acumuladoPct / 100) * innerH;
      return { ...r, x, y, h, lineY, cx: x + barW / 2, labelY, barW };
    });

    const linePath = bars
      .map((b, i) => `${i === 0 ? 'M' : 'L'} ${b.cx.toFixed(1)} ${b.lineY.toFixed(1)}`)
      .join(' ');

    const idx80 = bars.findIndex((b) => b.acumuladoPct >= 80);
    const y80 = PAD_T + innerH - 0.8 * innerH;

    return { maxValor, innerH, bars, linePath, idx80, y80, labelY };
  }, [W, display]);

  if (loading) {
    return (
      <div className="card-panel min-h-[380px] animate-pulse p-4">
        <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[304px] rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!display.length) {
    return (
      <div className="card-panel flex min-h-[200px] flex-col items-center justify-center gap-2 p-4 text-sm text-slate-500">
        <p className="font-medium text-slate-700 dark:text-slate-200">Pareto de clientes</p>
        <p>Sem clientes no filtro atual.</p>
      </div>
    );
  }

  const { maxValor, innerH, bars, linePath, idx80, y80, labelY } = chart;
  const baseY = PAD_T + innerH;

  return (
    <div className="card-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">Pareto de clientes</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Maiores clientes do filtro · barra = venda · linha = % acumulado
            {idx80 >= 0 ? ` · 80% em ${idx80 + 1} cliente(s)` : ''}
          </p>
        </div>
      </div>

      <div ref={chartWrapRef} className="relative w-full min-h-[304px] min-w-0">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full overflow-visible"
          role="img"
          aria-label="Gráfico Pareto de clientes"
        >
            {/* eixos */}
            <line
              x1={PAD_L}
              y1={baseY}
              x2={W - PAD_R}
              y2={baseY}
              className="stroke-slate-200 dark:stroke-slate-600"
              strokeWidth={1}
            />
            <line
              x1={PAD_L}
              y1={PAD_T}
              x2={PAD_L}
              y2={baseY}
              className="stroke-slate-200 dark:stroke-slate-600"
              strokeWidth={1}
            />

            {/* referência 80% */}
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y80}
              y2={y80}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1}
              opacity={0.85}
            />
            <text
              x={W - PAD_R + 6}
              y={y80 + 3}
              className="fill-amber-600 text-[9px] font-semibold"
            >
              80%
            </text>

            {bars.map((b) => (
              <g key={b.key}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.barW}
                  height={Math.max(b.h, 1)}
                  rx={2}
                  fill={PAINEL_PALETTE.barras[0]}
                  opacity={0.88}
                  className={onBarClick ? 'cursor-pointer hover:opacity-100' : undefined}
                  onClick={onBarClick ? () => onBarClick(b) : undefined}
                >
                  <title>{`${b.label}\n${formatMoeda(b.valor)}\nShare ${formatPct(b.sharePct)}\nAcumulado ${formatPct(b.acumuladoPct)}\nPedidos ${b.pedidos}`}</title>
                </rect>
                <circle cx={b.cx} cy={b.lineY} r={2.5} fill="#ef4444" />
                <text
                  x={b.cx}
                  y={labelY}
                  textAnchor="end"
                  transform={`rotate(-42 ${b.cx} ${labelY})`}
                  className="fill-slate-500 text-[9px]"
                >
                  {b.label.length > 18 ? `${b.label.slice(0, 16)}…` : b.label}
                </text>
              </g>
            ))}

            <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={2} />

            <text x={PAD_L - 8} y={PAD_T + 10} textAnchor="end" className="fill-slate-500 text-[10px]">
              {formatMoeda(maxValor, true)}
            </text>
            <text x={PAD_L - 8} y={baseY + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
              0
            </text>
            <text x={W - PAD_R + 6} y={PAD_T + 10} className="fill-rose-500 text-[10px] font-medium">
              100%
            </text>
            <text x={W - PAD_R + 6} y={baseY + 4} className="fill-rose-500 text-[10px] font-medium">
              0%
            </text>
        </svg>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
            <tr>
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Cliente</th>
              <th className="px-2 py-1.5 text-right">Venda</th>
              <th className="px-2 py-1.5 text-right">Share</th>
              <th className="px-2 py-1.5 text-right">Acumulado</th>
              <th className="px-2 py-1.5 text-right">Pedidos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {display.map((r, i) => (
              <tr
                key={r.key}
                className={onBarClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40' : undefined}
                onClick={onBarClick ? () => onBarClick(r) : undefined}
              >
                <td className="px-2 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
                <td className="max-w-[16rem] truncate px-2 py-1.5" title={r.label}>
                  {r.label}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatMoeda(r.valor)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.sharePct.toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.acumuladoPct.toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
