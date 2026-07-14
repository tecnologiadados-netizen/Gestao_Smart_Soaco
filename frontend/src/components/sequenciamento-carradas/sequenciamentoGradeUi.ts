import type { MouseEvent } from 'react';

/** Colunas editáveis da grade (Seq. + datas), na ordem de Tab. */
export const EDIT_COL_KEYS = ['prioridade', 'dataProducao', 'dataEntrega'] as const;
export type EditColKey = (typeof EDIT_COL_KEYS)[number];

export const DATE_COL_KEYS = ['dataProducao', 'dataEntrega'] as const;
export type DateColKey = (typeof DATE_COL_KEYS)[number];

export function escapeAttrSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function focusSeqEditInput(rowKey: string, colKey: EditColKey | DateColKey): void {
  const selector = `[data-editinput][data-rowkey="${escapeAttrSelector(rowKey)}"][data-colkey="${colKey}"]`;
  const el = document.querySelector<HTMLInputElement>(selector);
  if (el && !el.disabled) {
    el.focus();
    el.select?.();
  }
}

export const focusSeqDateInput = focusSeqEditInput;

type DatePickerAbertoRef = { current: string | null };

/**
 * Toggle do date picker nativo: 1º clique abre (showPicker); 2º clique no ícone/campo fecha (blur).
 */
export function onDateInputToggleClick(
  e: MouseEvent<HTMLInputElement>,
  fieldKey: string,
  abertoRef: DatePickerAbertoRef
): void {
  e.stopPropagation();
  const input = e.currentTarget;
  if (input.disabled) return;
  if (abertoRef.current === fieldKey) {
    input.blur();
    abertoRef.current = null;
    return;
  }
  abertoRef.current = fieldKey;
  try {
    if (typeof input.showPicker === 'function') input.showPicker();
  } catch {
    // Browser antigo ou restrição de user gesture — o clique nativo ainda pode abrir.
  }
}

export function onDateInputToggleBlur(fieldKey: string, abertoRef: DatePickerAbertoRef): void {
  if (abertoRef.current === fieldKey) abertoRef.current = null;
}

export function clearDatePickerAberto(abertoRef: DatePickerAbertoRef): void {
  abertoRef.current = null;
}
