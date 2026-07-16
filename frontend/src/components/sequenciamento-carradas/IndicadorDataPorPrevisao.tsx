const TITLE = 'Sem data de produção — posicionado pela previsão atual';

export default function IndicadorDataPorPrevisao({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-amber-300 bg-amber-50 px-1 py-px text-[10px] font-semibold leading-none text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 ${className}`}
      title={TITLE}
      aria-label={TITLE}
    >
      Prev.
    </span>
  );
}
