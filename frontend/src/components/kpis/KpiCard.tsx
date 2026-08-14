import { Link } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';

export type KpiCardVariant = 'pasta' | 'painel';

type KpiCardProps = {
  to: string;
  label: string;
  /** Texto auxiliar abaixo do título */
  descricao?: string;
  variant?: KpiCardVariant;
  /** Ícone customizado; se omitido, usa o ícone padrão da variant */
  icone?: ReactNode;
  favorito?: boolean;
  onToggleFavorito?: (e: MouseEvent) => void;
  ctaLabel?: string;
};

function IconePasta() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function IconePainel() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h4v8H3v-8zm7-6h4v14h-4V7zm7-4h4v18h-4V3z" />
    </svg>
  );
}

export default function KpiCard({
  to,
  label,
  descricao,
  variant = 'painel',
  icone,
  favorito = false,
  onToggleFavorito,
  ctaLabel = 'Abrir',
}: KpiCardProps) {
  const isPasta = variant === 'pasta';
  const borderAccent = isPasta ? 'border-l-primary-600' : 'border-l-accent-500';

  return (
    <Link
      to={to}
      className={`card-panel group relative flex flex-col gap-3 border-l-4 p-4 outline-none transition hover:border-primary-600/40 hover:shadow-soaco-lg focus-visible:ring-2 focus-visible:ring-primary-600 ${borderAccent}`}
    >
      {onToggleFavorito && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorito(e);
          }}
          className="absolute right-2.5 top-2.5 z-10 rounded-md p-1.5 text-accent-500 transition hover:bg-accent-500/10"
          title={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill={favorito ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      )}

      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-300">
          {icone ?? (isPasta ? <IconePasta /> : <IconePainel />)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-soaco-navy dark:text-soaco-white">{label}</p>
          {descricao ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{descricao}</p>
          ) : (
            <p className="mt-0.5 text-xs uppercase tracking-wide text-soaco-gray">
              {isPasta ? 'Pasta' : 'Painel'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:text-primary-700 dark:text-primary-300 dark:group-hover:text-primary-200">
        <span>{ctaLabel}</span>
        <svg
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

/** @deprecated Preferir `variant="pasta"` no KpiCard */
export function KpiCapaPasta(_props: { titulo: string }) {
  return <IconePasta />;
}

/** @deprecated Preferir `variant="painel"` no KpiCard */
export function KpiCapaPainel(_props: { titulo: string }) {
  return <IconePainel />;
}
