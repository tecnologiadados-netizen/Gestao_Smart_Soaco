/**
 * Vendedores/comercial que só comentam em cards (espelha RESTRICTED_CREATORS no backend).
 * Devem ser tratados como time comercial na regra "aguarda resposta".
 */
export const SYCRO_ORDER_COMMERCIAL_AUTHOR_LOGINS = new Set([
  'wellingtonsousa',
  'francelino',
  'marcosamorim',
  'gilvania',
]);

/** Indica se o autor não precisa escolher "time comercial / não comercial" ao aguardar resposta. */
export function isSycroOrderCommercialAuthor(
  login: string | null | undefined,
  isCommercialTeam: boolean
): boolean {
  const norm = (login ?? '').trim().toLowerCase();
  return isCommercialTeam || SYCRO_ORDER_COMMERCIAL_AUTHOR_LOGINS.has(norm);
}
