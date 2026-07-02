import { useCallback, useRef, useState } from 'react';
import type { Layout2D } from '../../api/logistica';

type Props = {
  layout2D: Layout2D | null;
  veiculoLabel?: string;
};

const VIEW_W = 400;
const VIEW_H = 220;

function VistaSvg({
  titulo,
  rects,
  viewBox,
}: {
  titulo: string;
  rects: Layout2D['superior'];
  viewBox: string;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{titulo}</p>
      <svg
        viewBox={viewBox}
        className="w-full border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50"
        style={{ maxHeight: VIEW_H }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width="100" height="100" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
        {rects.map((r) => (
          <g key={r.id}>
            <rect
              x={r.x * 100}
              y={r.y * 100}
              width={r.w * 100}
              height={r.h * 100}
              fill={r.overflow ? '#fecaca' : r.cor}
              fillOpacity={r.overflow ? 0.85 : 0.65}
              stroke={r.overflow ? '#dc2626' : r.cor}
              strokeWidth={r.overflow ? 0.8 : 0.4}
            />
            {r.w * 100 > 8 && r.h * 100 > 5 && (
              <text
                x={r.x * 100 + (r.w * 100) / 2}
                y={r.y * 100 + (r.h * 100) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="2.5"
                fill={r.overflow ? '#991b1b' : '#1e293b'}
              >
                {r.codigoProduto.length > 10 ? r.codigoProduto.slice(0, 8) + '…' : r.codigoProduto}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function CubagemViz2D({ layout2D, veiculoLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(3, Math.max(0.5, s * delta)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!layout2D || (layout2D.superior.length === 0 && layout2D.lateral.length === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
        Adicione itens à carga para visualizar o preenchimento.
      </div>
    );
  }

  const legendCodes = [...new Set(layout2D.superior.map((r) => r.codigoProduto))];

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {veiculoLabel && (
        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{veiculoLabel}</p>
      )}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1 transition-transform"
        >
          <VistaSvg titulo="Vista superior (piso)" rects={layout2D.superior} viewBox="0 0 100 100" />
          <VistaSvg titulo="Vista lateral (perfil)" rects={layout2D.lateral} viewBox="0 0 100 100" />
        </div>
      </div>
      {legendCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {legendCodes.map((cod, i) => {
            const cor = layout2D.superior.find((r) => r.codigoProduto === cod)?.cor ?? '#64748b';
            return (
              <span
                key={cod}
                className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"
              >
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cor }} />
                {cod}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
