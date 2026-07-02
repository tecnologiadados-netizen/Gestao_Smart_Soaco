import type { DreEstruturaNo } from './ArvoreContasDre';
import { isProvisaoCalculadaDre } from './dreProvisoesFolha';

/** Seções da DRE alimentadas por saídas SOACO (mesmo critério do backend). */
const CODIGOS_BASE_SAIDAS = ['4', '6', '8', '10', '11', '13', '14', '15', '17', '19.1'];

export function codigoRecebeSaidasDre(codigo: string): boolean {
  const c = codigo.trim();
  return CODIGOS_BASE_SAIDAS.some((b) => c === b || c.startsWith(`${b}.`));
}

export function noPermiteDetalheSaidas(node: DreEstruturaNo): boolean {
  if (node.tipo === 'T') return false;
  if (isProvisaoCalculadaDre(node.codigo)) return false;
  return codigoRecebeSaidasDre(node.codigo);
}

/** pathKeys analíticos de saídas sob o nó (inclui filhos). */
export function coletarPathKeysSaidasParaNo(node: DreEstruturaNo): string[] {
  const pks = new Set<string>();
  function walk(n: DreEstruturaNo) {
    if (n.tipo === 'A' && codigoRecebeSaidasDre(n.codigo)) pks.add(n.pathKey);
    n.children?.forEach(walk);
  }
  walk(node);
  return [...pks];
}

/** ids Nomus (contafinanceiro) para abrir o modal de lançamentos. */
export function coletarIdsContaParaNo(
  node: DreEstruturaNo,
  idsPorPathKey: Map<string, number[]>,
): number[] {
  const ids = new Set<number>();
  function walk(n: DreEstruturaNo) {
    if (n.tipo === 'A') {
      for (const id of idsPorPathKey.get(n.pathKey) ?? []) ids.add(id);
    }
    n.children?.forEach(walk);
  }
  walk(node);
  return [...ids].sort((a, b) => a - b);
}

export function mapaIdsPorPathKeyFromRecord(rec: Record<string, number[]>): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const [pk, ids] of Object.entries(rec)) {
    if (Array.isArray(ids) && ids.length > 0) map.set(pk, ids);
  }
  return map;
}
