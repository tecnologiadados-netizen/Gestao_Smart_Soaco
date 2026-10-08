import { useEffect, useRef, useState } from 'react';
import { formatEmissaoPainelBr } from '../../api/painelComercial';
import type { ResumoClientesRecorrentes } from '../../utils/resumirClientesRecorrentes';

function labelMesCurto(ym: string): string {
  const d = new Date(`${ym}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

const pctFmt = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const CORES = {
  recorrente: { fill: 'fill-sky-500', bar: 'bg-sky-500', active: 'fill-sky-500', idle: 'fill-sky-500/30' },
  reativado: { fill: 'fill-violet-500', bar: 'bg-violet-500', active: 'fill-violet-500', idle: 'fill-violet-500/30' },
  novo: { fill: 'fill-amber-500', bar: 'bg-amber-500', active: 'fill-amber-500', idle: 'fill-amber-500/30' },
};

export default function ClientesRecorrentesPainelChart({ resumo }: { resumo: ResumoClientesRecorrentes }) {
  const [hover, setHover] = useState<number | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const series = resumo.porMes;

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null && w > 0) setW(Math.max(260, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [series.length]);

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(1, series.length);
  const gapGrupo = 10;
  const grupoW = Math.max(18, (innerW - gapGrupo * (n - 1)) / n);
  const gapBar = 2;
  const barW = Math.max(4, (grupoW - gapBar * 2) / 3);
  const desde = resumo.janelaInicio ? formatEmissaoPainelBr(resumo.janelaInicio) : '—';
  const ate = resumo.janelaFim ? formatEmissaoPainelBr(resumo.janelaFim) : '—';
  const maxN = Math.max(1, ...series.map((s) => s.clientes));

  return (
    <div className="card-panel p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Clientes por tipo</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Recorrente: compra entre {desde} e {ate}. Reativado: já comprou antes disso, sem compra nessa janela. Novo:
            primeira compra naquele mês.
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {resumo.recorrentes} recorrentes · {resumo.reativados} reativados · {resumo.novos} novos
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Barra label="Recorrentes" n={resumo.recorrentes} total={resumo.clientes} fill={CORES.recorrente.bar} />
        <Barra label="Reativados" n={resumo.reativados} total={resumo.clientes} fill={CORES.reativado.bar} />
        <Barra label="Novos" n={resumo.novos} total={resumo.clientes} fill={CORES.novo.bar} />
      </div>

      {series.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum cliente no período.</p>
      ) : (
        <div ref={chartWrapRef} className="w-full min-w-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="auto"
            className="block w-full"
            role="img"
            aria-label="Clientes recorrentes, reativados e novos por mês"
            onMouseLeave={() => setHover(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = padT + innerH - t * innerH;
              return (
                <g key={t}>
                  <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
                    {Math.round(t * maxN)}
                  </text>
                </g>
              );
            })}
            {series.map((s, i) => {
              const x0 = padL + i * (grupoW + gapGrupo);
              const active = hover === null || hover === i;
              const barras = [
                { n: s.recorrentes, cor: CORES.recorrente },
                { n: s.reativados, cor: CORES.reativado },
                { n: s.novos, cor: CORES.novo },
              ];
              return (
                <g key={s.mes} onMouseEnter={() => setHover(i)}>
                  {barras.map((b, k) => {
                    const h = (b.n / maxN) * innerH;
                    const x = x0 + k * (barW + gapBar);
                    const y = padT + innerH - h;
                    return (
                      <rect
                        key={k}
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(h, b.n > 0 ? 2 : 0)}
                        rx="2"
                        className={active ? b.cor.active : b.cor.idle}
                      />
                    );
                  })}
                  <text x={x0 + grupoW / 2} y={H - 14} textAnchor="middle" className="fill-slate-500" fontSize="10">
                    {labelMesCurto(s.mes)}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover != null && series[hover] ? (
            <p className="mt-1 text-center text-xs text-slate-500">
              {labelMesCurto(series[hover].mes)}: {series[hover].recorrentes} recorrentes · {series[hover].reativados}{' '}
              reativados · {series[hover].novos} novos ({series[hover].clientes} clientes)
            </p>
          ) : (
            <p className="mt-1 text-center text-xs text-slate-400">Passe o mouse no mês para ver o detalhe.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Barra({ label, n, total, fill }: { label: string; n: number; total: number; fill: string }) {
  const pct = total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums">
          {n} <span className="font-normal text-slate-400">({pctFmt(pct)})</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%`, minWidth: n > 0 ? '4px' : 0 }} />
      </div>
    </div>
  );
}
