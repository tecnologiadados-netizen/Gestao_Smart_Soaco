type Props = {
  rotulo: string;
  dica: string;
  className?: string;
  /** Destaque no card primário (Empenho Liq). */
  primario?: boolean;
  /** Cabeçalho de grade com fundo escuro (ex.: primary-600). */
  headerClaro?: boolean;
};

/**
 * Rótulo com ícone ? e tooltip nativo (title) — explicação sem poluir o layout.
 */
export default function RotuloComDica({
  rotulo,
  dica,
  className = '',
  primario = false,
  headerClaro = false,
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      title={dica}
    >
      <span
        className={
          headerClaro
            ? 'text-white'
            : primario
              ? 'text-primary-700 dark:text-primary-300'
              : undefined
        }
      >
        {rotulo}
      </span>
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold leading-none ${
          headerClaro
            ? 'bg-white/25 text-white'
            : primario
              ? 'bg-primary-200/80 text-primary-800 dark:bg-primary-800/60 dark:text-primary-200'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
        }`}
        aria-hidden
      >
        ?
      </span>
    </span>
  );
}
