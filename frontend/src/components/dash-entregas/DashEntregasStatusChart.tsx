import { useEffect, useRef, useState } from 'react';
import type { Resumo } from '../../api/pedidos';
import { formatMoedaDash } from './dashEntregasUtils';

type Props = {
  resumo: Resumo | null;
  loading?: boolean;
  onAtrasadoClick: () => void;
  onEmDiaClick: () => void;
};

const ANIMATION_MS = 500;

export default function DashEntregasStatusChart({
  resumo,
  loading,
  onAtrasadoClick,
  onEmDiaClick,
}: Props) {
  const [animando, setAnimando] = useState({ pctA: 0, pctE: 0 });
  const [alvo, setAlvo] = useState({ pctA: 0, pctE: 0 });
  const animandoRef = useRef(animando);
  animandoRef.current = animando;

  useEffect(() => {
    if (!resumo) return;
    const totalValor = resumo.totalValorPendenteReal ?? 0;
    const atrasadosValor = resumo.atrasadosValorPendenteReal ?? 0;
    const usaValor = totalValor > 0;
    const total = resumo.total || 1;
    const atrasados = resumo.atrasados ?? 0;
    const pctA = usaValor
      ? Math.round((atrasadosValor / totalValor) * 100)
      : Math.round((atrasados / total) * 100);
    setAlvo({ pctA, pctE: 100 - pctA });
  }, [resumo]);

  useEffect(() => {
    const start = { ...animandoRef.current };
    const end = { ...alvo };
    const t0 = performance.now();
    const step = (t: number) => {
      const frac = Math.min((t - t0) / ANIMATION_MS, 1);
      const ease = 1 - (1 - frac) * (1 - frac);
      setAnimando({
        pctA: Math.round(start.pctA + (end.pctA - start.pctA) * ease),
        pctE: Math.round(start.pctE + (end.pctE - start.pctE) * ease),
      });
      if (frac < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [alvo.pctA, alvo.pctE]);

  if (loading || !resumo) {
    return (
      <div className="card-panel flex h-full min-h-[340px] animate-pulse flex-col p-5">
        <div className="mb-4 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mx-auto mt-8 h-44 w-44 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  const totalValor = resumo.totalValorPendenteReal ?? 0;
  const atrasadoValor = resumo.atrasadosValorPendenteReal ?? 0;
  const emDiaValor = resumo.emDiaValorPendenteReal ?? Math.max(0, totalValor - atrasadoValor);
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeAtrasados = (animando.pctA / 100) * circumference;
  const strokeEmDia = (animando.pctE / 100) * circumference;

  return (
    <div className="card-panel flex h-full min-h-[340px] flex-col p-5">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
          Composição do saldo pendente
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Por valor de saldo a faturar real
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row">
        <div className="relative shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="26"
              className="cursor-pointer text-amber-500 transition-opacity hover:opacity-90 dark:text-amber-400"
              strokeDasharray={`${strokeAtrasados} ${circumference}`}
              strokeLinecap="round"
              onClick={onAtrasadoClick}
              role="button"
              tabIndex={0}
              aria-label={`Atrasados ${animando.pctA}%`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onAtrasadoClick();
              }}
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="26"
              className="cursor-pointer text-emerald-500 transition-opacity hover:opacity-90 dark:text-emerald-400"
              strokeDasharray={`${strokeEmDia} ${circumference}`}
              strokeDashoffset={-strokeAtrasados}
              strokeLinecap="round"
              onClick={onEmDiaClick}
              role="button"
              tabIndex={0}
              aria-label={`Em dia ${animando.pctE}%`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onEmDiaClick();
              }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{animando.pctE}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">em dia</span>
          </div>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={onAtrasadoClick}
            className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-left transition hover:border-amber-500/40"
          >
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-700 dark:text-slate-200">Atrasado</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{animando.pctA}%</p>
              <p className="text-xs text-slate-500">{formatMoedaDash(atrasadoValor)}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={onEmDiaClick}
            className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left transition hover:border-emerald-500/40"
          >
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700 dark:text-slate-200">Em dia</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{animando.pctE}%</p>
              <p className="text-xs text-slate-500">{formatMoedaDash(emDiaValor)}</p>
            </div>
          </button>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            Clique nos segmentos para ver os pedidos
          </p>
        </div>
      </div>
    </div>
  );
}
