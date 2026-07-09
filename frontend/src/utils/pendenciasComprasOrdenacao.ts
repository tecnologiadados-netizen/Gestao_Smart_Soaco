/**
 * Reordenação de pendências compras com prioridade fixa manual (espelho do backend).
 * Prioridade fixa = entrar no grupo de prioridade, não na linha literal N.
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

export function prioridadesFixasDeLinhas(
  linhas: { idProduto: number; prioridadeFixa: number | null }[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const l of linhas) {
    if (l.prioridadeFixa != null) {
      map.set(l.idProduto, l.prioridadeFixa);
    }
  }
  return map;
}

export function opcoesPrioridadeGrupo(
  linhas: { prioridadeAutomatica: number }[]
): number[] {
  const max = linhas.length === 0 ? 0 : Math.max(...linhas.map((l) => l.prioridadeAutomatica));
  return Array.from({ length: max }, (_, i) => i + 1);
}
