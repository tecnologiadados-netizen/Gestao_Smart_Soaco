import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoeda, labelMesCurto } from './painelComercialUtils';

export type SerieMes = { mes: string; valor: number; qtde: number; pedidos: number };

export default function PainelComercialEvolucaoChart({
  series,
  loading,
  onPointClick,
}: {
  series: SerieMes[];
  loading?: boolean;
  onPointClick: (mes: string) => void;
}) {
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const H = 220;
  const padL = 54;
  const padR = 18;
  const padT = 18;
  const padB = 42;

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

  const points = useMemo(() => {
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const maxY = Math.max(...series.map((s) => s.valor), 1);
    const n = Math.max(1, series.length);
    return series.map((s, i) => {
      const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = padT + innerH - (s.valor / maxY) * innerH;
      return { ...s, x, y, maxY };
    });
  }, [series, W]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [points]);

  if (loading) {
    return (
      <div className="card-panel min-h-[320px] animate-pulse p-5">
        <div className="mb-4 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-[240px] rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!series.length) {
    return (
      <div className="card-panel flex min-h-[320px] items-center justify-center p-5 text-slate-500">
        Sem dados de evolução.
      </div>
    );
  }

  const maxY = Math.max(...series.map((s) => s.valor), 1);

  return (
    <div className="card-panel flex min-h-[320px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">Evolução mensal (valor)</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Clique em um mês para detalhar.</p>
      </div>

      <div ref={chartWrapRef} className="relative w-full min-h-[220px] flex-1 min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary-500/70" />
          {points.map((p) => (
            <g key={p.mes}>
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                className="fill-primary-500/85 hover:fill-primary-600 cursor-pointer"
                onClick={() => onPointClick(p.mes)}
              />
              <title>{`${labelMesCurto(p.mes)}\n${formatMoeda(p.valor)}\n${p.pedidos} PDs · ${p.qtde} un.`}</title>
            </g>
          ))}

          {/* eixo X (labels reduzidas) */}
          {points.map((p, i) => {
            const show = points.length <= 12 || i % 2 === 0;
            if (!show) return null;
            return (
              <text key={`${p.mes}-x`} x={p.x} y={H - 18} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {labelMesCurto(p.mes)}
              </text>
            );
          })}

          {/* eixo Y (0 e max) */}
          <text x={padL - 8} y={H - padB} textAnchor="end" className="fill-slate-500 text-[10px]">
            {formatMoeda(0, true)}
          </text>
          <text x={padL - 8} y={padT + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
            {formatMoeda(maxY, true)}
          </text>
        </svg>
      </div>
    </div>
  );
}

