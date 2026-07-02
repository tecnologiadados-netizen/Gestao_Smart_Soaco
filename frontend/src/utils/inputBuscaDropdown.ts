import type { FocusEvent, MouseEvent } from 'react';

/** Classe base — sem focus:ring (box-shadow repinta e pisca no Chrome). */
export const CLASSE_INPUT_BUSCA_DROPDOWN =
  'input-busca-dropdown w-full rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-primary-500 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100 dark:focus:border-primary-400';

type AtivarEdicao = () => void;

/** Props para campo de busca em dropdown — bloqueia autocomplete agressivo do Chrome. */
export function criarPropsInputBuscaDropdown(
  ativarEdicao: AtivarEdicao,
  opts?: { id?: string; readOnly?: boolean }
) {
  const ativar = (e: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
    ativarEdicao();
    e.stopPropagation();
  };

  return {
    id: opts?.id,
    type: 'text' as const,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'data-lpignore': 'true',
    'data-1p-ignore': true,
    'data-form-type': 'other',
    readOnly: opts?.readOnly ?? true,
    onMouseDown: ativar,
    onFocus: ativar,
  };
}
