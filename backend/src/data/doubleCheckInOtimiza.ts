/** Número inteiro positivo da solicitação aberta no Otimiza. */
export function numeroSolicitacaoOtimizaValido(valor: unknown): number | null {
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor) || valor <= 0 || valor > 2_147_483_647) return null;
    return valor;
  }
  if (typeof valor !== 'string' || !/^\d+$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) return null;
  return n;
}
