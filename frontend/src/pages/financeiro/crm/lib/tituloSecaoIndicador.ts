import { formatCurrency } from "./formatters";

export const CLASSE_BADGE_VALOR_SECAO_CRM =
  "inline-block rounded border border-white/70 bg-white/15 px-2 py-0.5 text-sm font-bold tabular-nums text-white";

export function formatValorSecaoIndicador(valor: number): string {
  return formatCurrency(valor);
}
