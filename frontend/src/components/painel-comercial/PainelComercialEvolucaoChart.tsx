import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import MetricToggle from './MetricToggle';
import type { MetricaPainel } from './metricaPainel';
import {
  formatMoeda,
  formatNumero,
  labelMesCurto,
  labelMesEixo,
  PAINEL_PALETTE,
} from './painelComercialUtils';

export type SerieMes = { mes: string; valor: number; qtde: number; pedidos: number };
export type { MetricaPainel };

function formatValorBarra(v: number, metrica: MetricaPainel): string {
  if (metrica === 'qtde') {
    if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)}k`;
    if (Math.abs(v) >= 1_000) return `${(v / 1000).toFixed(1)}k`;
    return formatNumero(v);
  }
  return formatMoeda(v, true).replace(/\s+/g, '\u00a0');
}

export default function PainelComercialEvolucaoChart({
  series,
  loading,
  onPointClick,
  title,
  subtitle = 'Clique para detalhar · Ctrl+clique para filtrar.',
  compact = false,
  metrica = 'valor',
  onMetricaChange,
  showValues = true,
  colorize = true,
  accentColor,
}: {
  series: SerieMes[];
  loading?: boolean;
  onPointClick?: (mes: string, e: MouseEvent) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  metrica?: MetricaPainel;
  onMetricaChange?: (v: MetricaPainel) => void;
  showValues?: boolean;
  colorize?: boolean;
  accentColor?: string;
}) {
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const padL = 54;
  const padR = 16;
  const padT = showValues ? 28 : 18;
  const padB = 72;
  const H = 268;

  const resolvedTitle =
    title ?? (metrica === 'qtde' ? 'Evolução mensal (unidades)' : 'Evolução mensal (valor)');

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null && w > 0) setW(Math.max(280, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [series.length]);

  const bars = useMemo(() => {
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const maxY = Math.max(...series.map((s) => (metrica === 'qtde' ? s.qtde : s.valor)), 1);
    const n = Math.max(1, series.length);
    const gap = n > 1 ? Math.min(6, innerW / n / 4) : 0;
    const barW = Math.max(4, (innerW - gap * (n - 1)) / n);
    return series.map((s, i) => {
      const yVal = metrica === 'qtde' ? s.qtde : s.valor;
      const x = padL + i * (barW + gap);
      const h = (yVal / maxY) * innerH;
      const y = padT + innerH - h;
      const color = colorize
        ? PAINEL_PALETTE.barras[i % PAINEL_PALETTE.barras.length]
        : PAINEL_PALETTE.barras[0];
      return { ...s, x, y, barW, h, maxY, yVal, color };
    });
  }, [series, W, metrica, colorize, padT, padB]);

  const shell = compact
    ? 'flex min-h-[300px] flex-col overflow-visible'
    : accentColor
      ? 'card-panel flex min-h-[340px] flex-col overflow-visible border-t-4 p-5'
      : 'card-panel flex min-h-[340px] flex-col overflow-visible p-5';

  const shellStyle = !compact && accentColor ? { borderTopColor: accentColor } : undefined;

  if (loading) {
    return (
      <div className={`${shell} animate-pulse`} style={shellStyle}>
        <div className="mb-4 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[240px] rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!series.length) {
    return (
      <div className={`${shell} items-center justify-center text-slate-500`} style={shellStyle}>
        Sem dados de evolução.
      </div>
    );
  }

  const maxY = Math.max(...series.map((s) => (metrica === 'qtde' ? s.qtde : s.valor)), 1);
  const clicavel = typeof onPointClick === 'function';
  const formatY = (v: number) => (metrica === 'qtde' ? formatNumero(v) : formatMoeda(v, true));

  return (
    <div className={shell} style={shellStyle}>
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">{resolvedTitle}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {onMetricaChange ? <MetricToggle value={metrica} onChange={onMetricaChange} /> : null}
      </div>

      <div ref={chartWrapRef} className="relative w-full min-h-[268px] flex-1 min-w-0 overflow-visible">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible w-full h-full">
          {bars.map((b) => {
            const label = formatValorBarra(b.yVal, metrica);
            const labelY = Math.max(12, b.y - 6);
            return (
              <g key={b.mes}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.barW}
                  height={Math.max(b.h, b.yVal > 0 ? 1 : 0)}
                  rx={3}
                  fill={b.color}
                  opacity={0.9}
                  className={clicavel ? 'cursor-pointer hover:opacity-100' : undefined}
                  onClick={clicavel ? (e) => onPointClick!(b.mes, e) : undefined}
                >
                  <title>{`${labelMesCurto(b.mes)}\nVenda: ${formatMoeda(b.valor)}\nQtde: ${formatNumero(b.qtde)}\nPedidos: ${formatNumero(b.pedidos)}\nClique para detalhar`}</title>
                </rect>
                {showValues && b.yVal > 0 && (
                  <text
                    x={b.x + b.barW / 2}
                    y={labelY}
                    textAnchor="middle"
                    className="fill-slate-600 text-[8px] font-semibold tabular-nums dark:fill-slate-300 pointer-events-none"
                  >
                    {label}
                  </text>
                )}
                <text
                  x={b.x + b.barW / 2}
                  y={H - 10}
                  textAnchor="end"
                  transform={`rotate(-42 ${b.x + b.barW / 2} ${H - 10})`}
                  className="fill-slate-500 text-[9px]"
                >
                  {labelMesEixo(b.mes)}
                </text>
              </g>
            );
          })}

          <text x={padL - 8} y={H - padB} textAnchor="end" className="fill-slate-500 text-[10px]">
            {formatY(0)}
          </text>
          <text x={padL - 8} y={padT + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
            {formatY(maxY)}
          </text>
        </svg>
      </div>
    </div>
  );
}
