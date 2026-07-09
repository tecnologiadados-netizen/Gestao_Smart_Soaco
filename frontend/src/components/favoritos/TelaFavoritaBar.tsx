import type { TelaFavorita } from '../../api/favoritos';

type TelaFavoritaBarProps = {
  favoritos: TelaFavorita[];
  favIdAtivo: number | null;
  onAplicar: (id: number) => void;
  className?: string;
  compact?: boolean;
};

export default function TelaFavoritaBar({
  favoritos,
  favIdAtivo,
  onAplicar,
  className = '',
  compact = false,
}: TelaFavoritaBarProps) {
  if (favoritos.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {!compact && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Favoritos:</span>
      )}
      {favoritos.map((fav) => (
        <button
          key={fav.id}
          type="button"
          onClick={() => onAplicar(fav.id)}
          title={fav.resumoFiltros}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            favIdAtivo === fav.id
              ? 'border-accent-500 bg-accent-500/15 text-accent-700 dark:text-accent-300'
              : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {fav.nome}
        </button>
      ))}
    </div>
  );
}
