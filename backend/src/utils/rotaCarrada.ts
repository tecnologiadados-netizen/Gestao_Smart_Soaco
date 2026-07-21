/** Espelho de `frontend/src/utils/rotaCarrada.ts` — regras de nome de rota/carrada. */

export const LABEL_CARRADA_EM_FORMACAO = 'Carrada em formação';

export function normalizeRotaNameStr(dm: string): string {
  return dm.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Carrada "em formação": nomes com constr/construção/cont.
 * Produção = max das demais + 30 dias; entrega/previsão exibe "Carrada em formação".
 */
export function isCarradaEmFormacao(carrada?: string | null): boolean {
  const n = normalizeRotaNameStr(carrada ?? '');
  if (!n) return false;
  if (n.includes('construcao') || n.includes('constr')) return true;
  return /(^|[^a-z0-9])cont([^a-z0-9]|$)/.test(n);
}

export function rotaFromPedidoRow(row: Record<string, unknown>): string {
  return String(row['Observacoes'] ?? row['Observações'] ?? row['Rota'] ?? row['rota'] ?? '').trim();
}
