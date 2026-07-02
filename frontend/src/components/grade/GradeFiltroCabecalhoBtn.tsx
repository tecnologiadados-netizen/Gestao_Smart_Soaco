import type { MouseEvent } from 'react';

type Props = {
  ativo: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
};

/** Botão ▾ do cabeçalho de grade; exibe funil sutil quando há filtro/ordenação ativos (estilo Excel). */
export default function GradeFiltroCabecalhoBtn({
  ativo,
  onClick,
  title = 'Classificar e filtrar',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 rounded border border-white/25 px-1 py-0.5 text-[9px] leading-none hover:bg-white/15 ${
        ativo ? 'text-amber-200' : 'text-white/90'
      } ${className}`.trim()}
      title={title}
      aria-label={ativo ? `${title} (filtro ativo)` : title}
    >
      {ativo ? (
        <svg
          className="h-2.5 w-2.5 shrink-0 opacity-90"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden
        >
          <path d="M1.2 1.5h9.6L7.2 6v3.8L4.8 9.5V6L1.2 1.5z" />
        </svg>
      ) : null}
      <span aria-hidden>▾</span>
    </button>
  );
}
