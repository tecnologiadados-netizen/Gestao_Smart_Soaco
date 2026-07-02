type BotaoObservacaoCelulaProps = {
  hasObservacao: boolean;
  bloqueado: boolean;
  titulo: string;
  onClick: () => void;
};

/** Ícone de balão de diálogo para observações por célula (grade Ressup Almox). */
export default function BotaoObservacaoCelula({
  hasObservacao,
  bloqueado,
  titulo,
  onClick,
}: BotaoObservacaoCelulaProps) {
  const base =
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border transition';
  const ativo = hasObservacao
    ? 'border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-900/70'
    : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-100';
  const bloqueadoCls =
    bloqueado && !hasObservacao
      ? 'cursor-not-allowed opacity-45 hover:bg-inherit dark:hover:bg-inherit'
      : bloqueado && hasObservacao
        ? 'cursor-default'
        : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={bloqueado && !hasObservacao}
      className={`${base} ${ativo} ${bloqueadoCls}`}
      title={titulo}
      aria-label={titulo}
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </button>
  );
}
