import type { DreEstruturaNo } from './ArvoreContasDre';

export type DreSaidasSoAcoLinha = {
  pathKey: string;
  periodo: string;
  valor: number;
};

export function mapaSinalPorPathKey(roots: DreEstruturaNo[]): Map<string, number> {
  const map = new Map<string, number>();
  function walk(nodes: DreEstruturaNo[]): void {
    for (const n of nodes) {
      if (n.tipo === 'A') map.set(n.pathKey, n.sinal ?? -1);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(roots);
  return map;
}

/** Agrega linhas da API (pathKey + período) para o mapa externo da grade DRE. */
export function montarValoresSaidasSoAcoPorPathKey(
  roots: DreEstruturaNo[],
  linhas: DreSaidasSoAcoLinha[],
  periodos: string[],
): Map<string, Record<string, number>> {
  const sinais = mapaSinalPorPathKey(roots);
  const out = new Map<string, Record<string, number>>();
  const setPeriodos = new Set(periodos);

  for (const row of linhas) {
    if (!setPeriodos.has(row.periodo)) continue;
    const sinal = sinais.get(row.pathKey) ?? -1;
    const signed = row.valor * sinal;
    const cur = out.get(row.pathKey) ?? {};
    cur[row.periodo] = (cur[row.periodo] ?? 0) + signed;
    out.set(row.pathKey, cur);
  }

  return out;
}
