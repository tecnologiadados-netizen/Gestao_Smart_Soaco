/**
 * Reordenação de pendências compras com prioridade fixa manual.
 * A prioridade fixa move o produto para o GRUPO de prioridade (como na planilha Excel),
 * não para a linha literal N da tabela.
 */

export type LinhaPrioridadeGrupo = {
  idProduto: number;
  prioridadeAutomatica: number;
  indiceOrdemAutomatica: number;
};

export function prioridadeGrupoEfetiva(
  linha: { idProduto: number; prioridadeAutomatica: number },
  prioridadesFixas: Map<number, number>
): number {
  return prioridadesFixas.get(linha.idProduto) ?? linha.prioridadeAutomatica;
}

export function aplicarPrioridadesFixasPendenciasCompras<T extends LinhaPrioridadeGrupo>(
  linhas: T[],
  prioridadesFixas: Map<number, number>
): T[] {
  if (linhas.length === 0) return [];
  if (prioridadesFixas.size === 0) return [...linhas];

  return [...linhas].sort((a, b) => {
    const pa = prioridadeGrupoEfetiva(a, prioridadesFixas);
    const pb = prioridadeGrupoEfetiva(b, prioridadesFixas);
    if (pa !== pb) return pa - pb;
    return a.indiceOrdemAutomatica - b.indiceOrdemAutomatica;
  });
}

export function anexarPrioridadeFixaNasLinhas<T extends { idProduto: number }>(
  linhas: T[],
  prioridadesFixas: Map<number, number>
): (T & { prioridadeFixa: number | null })[] {
  return linhas.map((l) => ({
    ...l,
    prioridadeFixa: prioridadesFixas.get(l.idProduto) ?? null,
  }));
}

export function maxPrioridadeGrupoDisponivel(
  linhas: { prioridadeAutomatica: number }[]
): number {
  if (linhas.length === 0) return 0;
  return Math.max(...linhas.map((l) => l.prioridadeAutomatica));
}
