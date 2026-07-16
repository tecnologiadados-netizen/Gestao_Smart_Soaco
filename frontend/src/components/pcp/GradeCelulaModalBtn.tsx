import type { ReactNode } from 'react';

const BASE =
  'inline-flex min-h-7 min-w-[2.75rem] items-center justify-center rounded-md border px-2.5 py-1 text-sm font-semibold tabular-nums text-white shadow-sm transition focus:outline-none focus:ring-2';

/** Estilo padrão de células clicáveis que abrem modal no módulo PCP (referência: coluna PC Pend). */
export const GRADE_CELULA_MODAL_BTN_CLASS = `${BASE} ml-auto border-primary-500/70 bg-primary-600 hover:bg-primary-500 focus:ring-primary-400/60 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400`;

export const GRADE_CELULA_MODAL_BTN_LARANJA_CLASS = `${BASE} ml-auto border-amber-500/80 bg-amber-600 hover:bg-amber-500 focus:ring-amber-400/60 dark:border-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400`;

export const GRADE_CELULA_MODAL_BTN_VERDE_CLASS = `${BASE} ml-auto border-emerald-500/80 bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-400/60 dark:border-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-400`;

export type GradeCelulaModalBtnVariant = 'primary' | 'laranja' | 'verde';
export type GradeCelulaModalBtnAlign = 'left' | 'center' | 'right';

type Props = {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
  variant?: GradeCelulaModalBtnVariant;
  /** Alinhamento do botão na célula (padrão: right, compatível com grades PCP). */
  align?: GradeCelulaModalBtnAlign;
};

function classesVariante(variant: GradeCelulaModalBtnVariant, align: GradeCelulaModalBtnAlign): string {
  const margin =
    align === 'left' ? '' : align === 'center' ? 'mx-auto' : 'ml-auto';
  const colors =
    variant === 'verde'
      ? 'border-emerald-500/80 bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-400/60 dark:border-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-400'
      : variant === 'laranja'
        ? 'border-amber-500/80 bg-amber-600 hover:bg-amber-500 focus:ring-amber-400/60 dark:border-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400'
        : 'border-primary-500/70 bg-primary-600 hover:bg-primary-500 focus:ring-primary-400/60 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400';
  return `${BASE} ${margin} ${colors}`.replace(/\s+/g, ' ').trim();
}

export default function GradeCelulaModalBtn({
  children,
  onClick,
  title,
  className,
  variant = 'primary',
  align = 'right',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={className ?? classesVariante(variant, align)}
    >
      {children}
    </button>
  );
}
