import type { LinhaProgramacaoProducao } from '../components/programacao-producao/types';
import type { SortLevel } from '../hooks/useGradeFiltrosExcel';
import { getPpSortValue } from './programacaoProducaoGradeCells';

/** Valores vazios, "—" ou sequência zerada/indefinida vão sempre para o final. */
export function isPpSortValueBlank(val: string | number, columnId: string): boolean {
  if (columnId === 'sequencia') {
    if (typeof val !== 'number' || !Number.isFinite(val)) return true;
    return val <= 0;
  }
  if (typeof val === 'number') {
    return !Number.isFinite(val) || val === -Infinity;
  }
  const s = String(val).trim();
  return !s || s === '—';
}

export function compareProgramacaoProducaoRows(
  a: LinhaProgramacaoProducao,
  b: LinhaProgramacaoProducao,
  levels: SortLevel[]
): number {
  for (const level of levels) {
    const av = getPpSortValue(a, level.id);
    const bv = getPpSortValue(b, level.id);
    const aBlank = isPpSortValueBlank(av, level.id);
    const bBlank = isPpSortValueBlank(bv, level.id);
    if (aBlank && bBlank) continue;
    if (aBlank) return 1;
    if (bBlank) return -1;

    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
    }
    if (cmp !== 0) return level.dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}
