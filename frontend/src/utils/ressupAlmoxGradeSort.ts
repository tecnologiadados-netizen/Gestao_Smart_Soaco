import type { SortLevel } from '../hooks/useGradeFiltrosExcel';

export const SORT_DEFAULT_RESSUP_ALMOX: SortLevel[] = [
  { id: 'coleta', dir: 'asc' },
  { id: 'descricao', dir: 'asc' },
];

const COLUNAS_NUMERICAS = new Set([
  'qtdeEmp',
  'cm',
  'cobertura',
  'qtdSolicit',
  'qtdeSug',
  'qtdAprov',
  'estoqAtual',
  'qtdeUltComp',
  'estSeg',
  'pcPend',
  'agPag',
  'saldoProjetado',
]);

const COLUNAS_DATA = new Set([
  'dataSolicit',
  'dataNecess',
  'dataNecessSug',
  'dataNecessAprov',
  'dataUltEntrada',
]);

export function getOrderLabelsForRessupCol(columnId: string): { asc: string; desc: string } {
  if (COLUNAS_NUMERICAS.has(columnId)) {
    return { asc: 'Menor para Maior', desc: 'Maior para Menor' };
  }
  if (COLUNAS_DATA.has(columnId)) {
    return { asc: 'Mais antigo para mais recente', desc: 'Mais recente para mais antigo' };
  }
  return { asc: 'De A a Z', desc: 'De Z a A' };
}

export function parseDateSortValue(s: string): number {
  const raw = (s ?? '').trim();
  if (!raw || raw === '—') return 0;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const t = new Date(iso[0]).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const t = new Date(`${br[3]}-${br[2]}-${br[1]}`).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function isRessupColData(columnId: string): boolean {
  return COLUNAS_DATA.has(columnId);
}

export function isRessupColNumeric(columnId: string): boolean {
  return COLUNAS_NUMERICAS.has(columnId);
}

export function sortLevelsEqual(a: SortLevel[], b: SortLevel[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => l.id === b[i]?.id && l.dir === b[i]?.dir);
}
