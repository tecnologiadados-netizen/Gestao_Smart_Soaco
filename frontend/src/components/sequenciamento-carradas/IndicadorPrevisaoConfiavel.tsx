import type { StatusConfiavelCalendario } from './previsaoConfiavelCalendario';

const TITULOS: Record<StatusConfiavelCalendario, string> = {
  sim: 'Confiável',
  nao: 'Não confiável',
  branco: 'Em branco (sem escolha de previsão confiável)',
};

function BadgeSim({ className = '' }: { className?: string }) {
  const title = TITULOS.sim;
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200 ${className}`}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path
          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function BadgeNao({ className = '' }: { className?: string }) {
  const title = TITULOS.nao;
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-900/40 dark:text-rose-200 ${className}`}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function BadgeBranco({ className = '' }: { className?: string }) {
  const title = TITULOS.branco;
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-400 bg-slate-50 text-[10px] font-bold leading-none text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 ${className}`}
      title={title}
      aria-label={title}
    >
      ?
    </span>
  );
}

/** Um único selo pelo status. */
export function IndicadorPrevisaoConfiavel({
  status,
  className = '',
}: {
  status: StatusConfiavelCalendario;
  className?: string;
}) {
  if (status === 'sim') return <BadgeSim className={className} />;
  if (status === 'nao') return <BadgeNao className={className} />;
  return <BadgeBranco className={className} />;
}

/** Todos os status presentes (ordem: sim → nao → branco). */
export default function IndicadoresPrevisaoConfiavel({
  statuses,
  className = '',
}: {
  statuses: StatusConfiavelCalendario[];
  className?: string;
}) {
  if (!statuses.length) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {statuses.map((s) => (
        <IndicadorPrevisaoConfiavel key={s} status={s} />
      ))}
    </span>
  );
}
