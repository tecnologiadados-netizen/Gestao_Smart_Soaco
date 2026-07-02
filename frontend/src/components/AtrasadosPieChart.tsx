import { useEffect, useState, useRef } from 'react';
import type { Resumo } from '../api/pedidos';

interface AtrasadosPieChartProps {
  resumo: Resumo | null;
  loading?: boolean;
  /** Quando preenchido, indica que o resumo está filtrado por esta rota (exibe no título). */
  rotaFiltro?: string | null;
}

const ANIMATION_MS = 500;

export default function AtrasadosPieChart({ resumo, loading, rotaFiltro }: AtrasadosPieChartProps) {
  const [animando, setAnimando] = useState({ pctA: 0, pctE: 0, total: 0 });
  const [alvo, setAlvo] = useState({ pctA: 0, pctE: 0, total: 0 });
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
    const pctE = 100 - pctA;
    const totalExibido = usaValor ? totalValor : total;
    setAlvo({ pctA, pctE, total: totalExibido });
  }, [
    resumo?.total,
    resumo?.atrasados,
    resumo?.totalValorPendenteReal,
    resumo?.atrasadosValorPendenteReal,
  ]);

  useEffect(() => {
    const start = { ...animandoRef.current };
    const end = { ...alvo };
    const t0 = performance.now();
    const step = (t: number) => {
      const elapsed = t - t0;
      const frac = Math.min(elapsed / ANIMATION_MS, 1);
      const ease = 1 - (1 - frac) * (1 - frac);
      setAnimando({
        pctA: Math.round(start.pctA + (end.pctA - start.pctA) * ease),
        pctE: Math.round(start.pctE + (end.pctE - start.pctE) * ease),
        total: Math.round(start.total + (end.total - start.total) * ease),
      });
      if (frac < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [alvo.pctA, alvo.pctE, alvo.total]);

  if (loading || !resumo) {
    return (
      <div className="card-panel h-[320px] flex flex-col">
        <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white mb-4 shrink-0">
          Atrasados vs Em dia (%)
        </h3>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
          <div className="relative shrink-0">
            <svg width="180" height="180" viewBox="0 0 180 180" className="animate-spin-slow">
              <circle
                cx="90"
                cy="90"
                r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray="80 420"
                className="text-primary-500/80 dark:text-primary-400/80"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = resumo.total || 1;
  const totalValor = resumo.totalValorPendenteReal ?? 0;
  const usaValor = totalValor > 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeAtrasados = (animando.pctA / 100) * circumference;
  const strokeEmDia = (animando.pctE / 100) * circumference;

  return (
    <div className="card-panel h-[320px] flex flex-col">
      <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white mb-1 shrink-0">
        Atrasados vs Em dia (%)
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 shrink-0">
        {usaValor ? 'Por valor pendente real' : 'Por quantidade de itens'}
      </p>
      {rotaFiltro && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate" title={rotaFiltro}>
          Rota: {rotaFiltro}
        </p>
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center gap-6">
        <div className="relative shrink-0">
          <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="24"
              className="text-accent-500 dark:text-accent-400 transition-[stroke-dasharray] duration-300 ease-out"
              strokeDasharray={`${strokeAtrasados} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="24"
              className="text-emerald-500 dark:text-emerald-400 transition-[stroke-dasharray,stroke-dashoffset] duration-300 ease-out"
              strokeDasharray={`${strokeEmDia} ${circumference}`}
              strokeDashoffset={-strokeAtrasados}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">
              {animando.pctE}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              em dia
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Atrasados: {animando.pctA}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Em dia: {animando.pctE}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
