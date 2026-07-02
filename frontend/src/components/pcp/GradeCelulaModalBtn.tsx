import type { ReactNode } from 'react';

/** Estilo padrão de células clicáveis que abrem modal no módulo PCP (referência: coluna PC Pend). */
export const GRADE_CELULA_MODAL_BTN_CLASS =
  'ml-auto inline-flex min-h-7 min-w-[2.75rem] items-center justify-center rounded-md border border-primary-500/70 bg-primary-600 px-2.5 py-1 text-sm font-semibold tabular-nums text-white shadow-sm transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/60 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400';

export const GRADE_CELULA_MODAL_BTN_LARANJA_CLASS =
  'ml-auto inline-flex min-h-7 min-w-[2.75rem] items-center justify-center rounded-md border border-amber-500/80 bg-amber-600 px-2.5 py-1 text-sm font-semibold tabular-nums text-white shadow-sm transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 dark:border-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400';

export const GRADE_CELULA_MODAL_BTN_VERDE_CLASS =
  'ml-auto inline-flex min-h-7 min-w-[2.75rem] items-center justify-center rounded-md border border-emerald-500/80 bg-emerald-600 px-2.5 py-1 text-sm font-semibold tabular-nums text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-400';

export type GradeCelulaModalBtnVariant = 'primary' | 'laranja' | 'verde';

type Props = {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
  variant?: GradeCelulaModalBtnVariant;
};

export default function GradeCelulaModalBtn({
  children,
  onClick,
  title,
  className,
  variant = 'primary',
}: Props) {
  const variantClass =
    variant === 'verde'
      ? GRADE_CELULA_MODAL_BTN_VERDE_CLASS
      : variant === 'laranja'
        ? GRADE_CELULA_MODAL_BTN_LARANJA_CLASS
        : GRADE_CELULA_MODAL_BTN_CLASS;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={className ?? variantClass}
    >
      {children}
    </button>
  );
}
