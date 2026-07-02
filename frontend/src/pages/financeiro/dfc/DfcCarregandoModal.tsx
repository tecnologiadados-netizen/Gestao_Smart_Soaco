import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ETAPAS = [
  'Consultando lançamentos financeiros…',
  'Agregando receitas e pagamentos…',
  'Calculando projeções de caixa…',
  'Montando a demonstração (DFC)…',
];

type Props = {
  aberto: boolean;
};

export default function DfcCarregandoModal({ aberto }: Props) {
  const [etapaIdx, setEtapaIdx] = useState(0);

  useEffect(() => {
    if (!aberto) {
      setEtapaIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setEtapaIdx((i) => (i + 1) % ETAPAS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [aberto]);

  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [aberto]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-slate-900/55 dark:bg-slate-950/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="dfc-carregando-titulo"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800 px-8 py-10 flex flex-col items-center gap-6">
        <div className="relative w-full h-36 flex items-end justify-center gap-2 px-4" aria-hidden>
          {[0.55, 0.85, 0.45, 1, 0.7, 0.9, 0.5].map((h, i) => (
            <div
              key={i}
              className={`dfc-load-bar w-7 sm:w-8 rounded-t-md origin-bottom ${
                i % 2 === 0
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-primary-500 dark:bg-primary-400'
              }`}
              style={{
                height: `${Math.round(h * 88)}px`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
          <svg
            className="absolute inset-x-6 bottom-8 h-20 w-[calc(100%-3rem)] pointer-events-none dfc-load-line"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M0 48 Q40 42 70 28 T140 18 T200 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-amber-500 dark:text-amber-400"
            />
          </svg>
          <span className="absolute -top-1 left-6 text-sm font-bold text-emerald-600 dark:text-emerald-400 dfc-load-float opacity-80">
            R$
          </span>
          <span
            className="absolute top-2 right-8 text-xs font-semibold text-rose-500 dark:text-rose-400 dfc-load-float opacity-70"
            style={{ animationDelay: '0.4s' }}
          >
            −
          </span>
          <span
            className="absolute top-6 right-16 text-sm font-bold text-sky-600 dark:text-sky-400 dfc-load-float opacity-75"
            style={{ animationDelay: '0.8s' }}
          >
            +
          </span>
        </div>

        <div className="text-center space-y-2 w-full">
          <h2
            id="dfc-carregando-titulo"
            className="text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            Carregando demonstração financeira
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 min-h-[1.25rem] transition-opacity duration-300">
            {ETAPAS[etapaIdx]}
          </p>
        </div>

        <div className="flex gap-1.5" aria-hidden>
          {ETAPAS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === etapaIdx
                  ? 'w-6 bg-primary-600 dark:bg-primary-400'
                  : 'w-1.5 bg-slate-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
