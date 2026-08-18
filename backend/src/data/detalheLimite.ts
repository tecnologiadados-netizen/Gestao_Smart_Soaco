/** Limite do modal de detalhe DFC / saídas. */
export const LIMITE_DETALHE_MODAL = 2000;

/** Limite do modal de detalhe DRE (receitas / devoluções). */
export const LIMITE_DETALHE_DRE_MODAL = 8000;

/**
 * Teto de segurança no export XLSX (ExcelJS no browser).
 * Acima disso o servidor marca truncado e o Excel avisa na aba Filtros.
 */
export const LIMITE_DETALHE_EXPORT = 200_000;

/** `null` = sem corte (export). `undefined` = usa o padrão do modal. */
export function resolverLimiteDetalhe(
  limite: number | null | undefined,
  padrao: number,
): number | null {
  if (limite === null) return null;
  if (limite === undefined) return padrao;
  if (!Number.isFinite(limite) || limite <= 0) return padrao;
  return Math.trunc(limite);
}

export function aplicarLimiteDetalhe<T>(
  rows: T[],
  limite: number | null | undefined,
  padrao: number,
): { detalhes: T[]; truncado: boolean } {
  const cap = resolverLimiteDetalhe(limite, padrao);
  if (cap == null) {
    if (rows.length > LIMITE_DETALHE_EXPORT) {
      return { detalhes: rows.slice(0, LIMITE_DETALHE_EXPORT), truncado: true };
    }
    return { detalhes: rows, truncado: false };
  }
  return { detalhes: rows.slice(0, cap), truncado: rows.length > cap };
}

/** Bind de `LIMIT ?` no SQL (sempre +1 para detectar truncamento). */
export function limiteSqlBind(limite: number | null | undefined, padrao: number): number {
  const cap = resolverLimiteDetalhe(limite, padrao);
  return (cap ?? LIMITE_DETALHE_EXPORT) + 1;
}
