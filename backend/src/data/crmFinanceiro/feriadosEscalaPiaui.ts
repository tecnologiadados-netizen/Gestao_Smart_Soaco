import { parseLocalDate } from './datasLocais.js';
import { isFeriadoNacional } from './feriadosNacionais.js';

/**
 * Feriados da escala de produção — Teresina/PI.
 * Não usa a lista do Nordeste inteiro (CRM de vencimento/atraso).
 */
export const FERIADOS_ESCALA_PIAUI = [
  { dia: 13, mes: 3, nome: 'Dia da Batalha do Jenipapo', tipo: 'estadual' },
  { dia: 16, mes: 8, nome: 'Aniversário de Teresina', tipo: 'municipal' },
  { dia: 19, mes: 10, nome: 'Criação do Estado do Piauí', tipo: 'estadual' },
  { dia: 8, mes: 12, nome: 'Nossa Senhora da Conceição (Teresina)', tipo: 'municipal' },
] as const;

export function isFeriadoEscalaPiauiLocal(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = parseLocalDate(value.slice(0, 10));
  if (!date) return false;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return FERIADOS_ESCALA_PIAUI.some((f) => f.mes === month && f.dia === day);
}

/** Nacional + estadual PI + municipal Teresina (escala Camasi / pontual). */
export function isFeriadoEscalaTeresina(value: string | null | undefined): boolean {
  if (!value) return false;
  return isFeriadoNacional(value) || isFeriadoEscalaPiauiLocal(value);
}
