/** Normaliza nome de fornecedor para comparação (rateio DRE). */
export function normalizarNomeFornecedorRateio(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s*(?:\([^)]*\)\s*)+$/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function nomesFornecedorRateioEquivalentes(a: string, b: string): boolean {
  const na = normalizarNomeFornecedorRateio(a);
  const nb = normalizarNomeFornecedorRateio(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function linhaPassaFornecedoresRateio(
  nome: string | null | undefined,
  nomesConfigurados: readonly string[],
): boolean {
  const alvo = normalizarNomeFornecedorRateio(nome ?? '');
  if (!alvo) return false;
  return nomesConfigurados.some((n) => nomesFornecedorRateioEquivalentes(n, alvo));
}
