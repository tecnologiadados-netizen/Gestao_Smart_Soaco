import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useHorizontalWheelScroll } from './useHorizontalWheelScroll';
import {
  encodeNumericColumnFilter,
  isNumericColumnFilter,
  matchesNumericColumnFilter,
  parseNumeroFiltroInput,
  parseNumericColumnFilter,
  type NumericFilterOp,
} from '../utils/gradeFiltroNumerico';
import {
  clearGradeFiltrosPedidos,
  loadGradeFiltrosPedidos,
  saveGradeFiltrosPedidos,
} from '../utils/persistFiltros';

export type SortDir = 'asc' | 'desc';
export type SortLevel = { id: string; dir: SortDir };
export type ExcelFilterDraft = {
  search: string;
  selected: string[];
  numericOp?: NumericFilterOp | null;
  numericV1?: string;
  numericV2?: string;
  /** Direção escolhida no menu; aplicada ao confirmar (Ordenar). */
  sortDir?: SortDir | null;
};
type SortState = { key: string; direction: SortDir } | null;

const FILTER_SEP = '\u0001';
/** Valor interno: nenhum item selecionado no filtro Excel (grade vazia). */
export const FILTER_NONE = '\u0000';

/** Verifica se a linha passa nos filtros de coluna (exceto `excludeKey`, para opções responsivas). */
export function rowMatchesColumnFilters<T>(
  row: T,
  filters: Record<string, string>,
  getCellText: (row: T, columnId: string) => string,
  excludeKey?: string,
  getNumericValue?: (row: T, columnId: string) => number,
  getCellFilterValues?: (row: T, columnId: string) => string[] | null
): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (!value?.trim() || key === excludeKey) continue;
    if (value === FILTER_NONE) return false;
    if (isNumericColumnFilter(value)) {
      const n = getNumericValue?.(row, key) ?? NaN;
      if (!matchesNumericColumnFilter(n, value)) return false;
      continue;
    }
    const selected = value.split(FILTER_SEP).filter(Boolean);
    const multi = getCellFilterValues?.(row, key);
    if (multi) {
      if (selected.length > 1 || value.includes(FILTER_SEP)) {
        if (!multi.some((t) => selected.includes(t))) return false;
      } else if (!multi.some((t) => t.toLowerCase().includes(value.trim().toLowerCase()))) {
        return false;
      }
      continue;
    }
    const cellText = getCellText(row, key);
    if (selected.length > 1 || value.includes(FILTER_SEP)) {
      if (!selected.includes(cellText)) return false;
    } else if (!cellText.toLowerCase().includes(value.trim().toLowerCase())) {
      return false;
    }
  }
  return true;
}

function todosValoresSelecionados(selected: string[], valores: string[]): boolean {
  if (valores.length === 0) return true;
  const set = new Set(selected);
  return valores.every((v) => set.has(v));
}

export type UseGradeFiltrosExcelOptions<T> = {
  rows: T[];
  columnIds: string[];
  getCellText: (row: T, columnId: string) => string;
  /** Valores múltiplos por célula (ex.: badges na coluna Status). Null = texto único via getCellText. */
  getCellFilterValues?: (row: T, columnId: string) => string[] | null;
  valueForSort?: (row: T, columnId: string) => string | number;
  defaultSortLevels?: SortLevel[];
  /** Substitui comparação padrão (ex.: vazios sempre no final). */
  compareRows?: (
    a: T,
    b: T,
    levels: SortLevel[],
    getSortValue: (row: T, columnId: string) => string | number
  ) => number;
  /**
   * Se true, restaura/persiste filtros Excel e sortState da grade em sessionStorage
   * (escopo: sessão da aba; 1º acesso limpo).
   */
  persistGradeFilters?: boolean;
};

export function sortLevelsIguais(a: SortLevel[], b: SortLevel[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => l.id === b[i]?.id && l.dir === b[i]?.dir);
}

export function compareRowsBySortLevels<T>(
  a: T,
  b: T,
  levels: SortLevel[],
  getSortValue: (row: T, columnId: string) => string | number
): number {
  for (const level of levels) {
    const av = getSortValue(a, level.id);
    const bv = getSortValue(b, level.id);
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

export function useGradeFiltrosExcel<T>({
  rows,
  columnIds,
  getCellText,
  getCellFilterValues,
  valueForSort,
  defaultSortLevels = [],
  compareRows,
  persistGradeFilters = false,
}: UseGradeFiltrosExcelOptions<T>) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(() =>
    persistGradeFilters ? loadGradeFiltrosPedidos().columnFilters : {}
  );
  const [excelFilterDrafts, setExcelFilterDrafts] = useState<Record<string, ExcelFilterDraft>>({});
  const [colunaFiltroAberta, setColunaFiltroAberta] = useState<string | null>(null);
  const [filtroAbertoRect, setFiltroAbertoRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [sortState, setSortState] = useState<SortState>(() =>
    persistGradeFilters ? loadGradeFiltrosPedidos().sortState : null
  );
  const [sortLevels, setSortLevels] = useState<SortLevel[]>(defaultSortLevels);
  const filtroDropdownRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(tableScrollRef, true, true);
  const excelFilterDraftsRef = useRef(excelFilterDrafts);
  excelFilterDraftsRef.current = excelFilterDrafts;
  const valoresUnicosRef = useRef<Record<string, string[]>>({});
  const columnFiltersRef = useRef(columnFilters);
  columnFiltersRef.current = columnFilters;

  const getSortValue = useCallback(
    (row: T, columnId: string) => (valueForSort ? valueForSort(row, columnId) : getCellText(row, columnId)),
    [getCellText, valueForSort]
  );

  const valoresUnicosPorColuna = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const colId of columnIds) {
      const values = new Set<string>();
      for (const row of rows) {
        if (!rowMatchesColumnFilters(row, columnFilters, getCellText, colId, undefined, getCellFilterValues))
          continue;
        const multi = getCellFilterValues?.(row, colId);
        if (multi) {
          for (const v of multi) values.add(v);
        } else {
          values.add(getCellText(row, colId));
        }
      }
      out[colId] = [...values].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }
    return out;
  }, [rows, columnIds, getCellText, getCellFilterValues, columnFilters]);

  valoresUnicosRef.current = valoresUnicosPorColuna;

  const setFiltroColuna = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);

  const abrirFiltroExcel = useCallback((key: string, e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setColunaFiltroAberta((prev) => {
      if (prev === key) {
        setFiltroAbertoRect(null);
        return null;
      }
      const valores = valoresUnicosRef.current[key] ?? [];
      const filtroAtual = columnFiltersRef.current[key];
      let selected: string[];
      let numericOp: NumericFilterOp | null = null;
      let numericV1 = '';
      let numericV2 = '';
      if (filtroAtual === FILTER_NONE) {
        selected = [];
      } else if (filtroAtual && isNumericColumnFilter(filtroAtual)) {
        selected = valores;
        const spec = parseNumericColumnFilter(filtroAtual);
        if (spec) {
          numericOp = spec.op;
          numericV1 = String(spec.v1);
          numericV2 = spec.v2 != null ? String(spec.v2) : '';
        }
      } else if (filtroAtual) {
        selected = filtroAtual.split(FILTER_SEP).filter(Boolean);
      } else {
        selected = valores;
      }
      const sortDir =
        sortState?.key === key ? sortState.direction : null;
      setExcelFilterDrafts((drafts) => ({
        ...drafts,
        [key]: { search: '', selected, numericOp, numericV1, numericV2, sortDir },
      }));
      setFiltroAbertoRect({ top: rect.bottom + 4, left: rect.left, width: 288 });
      return key;
    });
  }, [sortState]);

  const fecharFiltroExcel = useCallback(() => {
    setColunaFiltroAberta(null);
    setFiltroAbertoRect(null);
  }, []);

  const aplicarFiltroExcel = useCallback(
    (key: string) => {
      const draft = excelFilterDraftsRef.current[key];
      const valores = valoresUnicosRef.current[key] ?? [];
      if (draft?.numericOp && draft.numericV1?.trim()) {
        const n1 = parseNumeroFiltroInput(draft.numericV1);
        if (n1 != null) {
          if (draft.numericOp === 'between') {
            const n2 = parseNumeroFiltroInput(draft.numericV2 ?? '');
            if (n2 != null) {
              setFiltroColuna(key, encodeNumericColumnFilter('between', n1, n2));
              fecharFiltroExcel();
              return;
            }
          } else {
            setFiltroColuna(key, encodeNumericColumnFilter(draft.numericOp, n1));
            fecharFiltroExcel();
            return;
          }
        }
      }
      if (!draft || draft.selected.length === 0) {
        setFiltroColuna(key, FILTER_NONE);
      } else if (todosValoresSelecionados(draft.selected, valores)) {
        setFiltroColuna(key, '');
      } else {
        setFiltroColuna(key, draft.selected.join(FILTER_SEP));
      }
      fecharFiltroExcel();
    },
    [setFiltroColuna, fecharFiltroExcel]
  );

  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const handle = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (filtroDropdownRef.current && !filtroDropdownRef.current.contains(target)) {
        fecharFiltroExcel();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colunaFiltroAberta, fecharFiltroExcel]);

  useEffect(() => {
    if (!colunaFiltroAberta) return;
    const el = tableScrollRef.current;
    if (!el) return;
    const handle = () => fecharFiltroExcel();
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, [colunaFiltroAberta, fecharFiltroExcel]);

  const deferredColumnFilters = useDeferredValue(columnFilters);

  const getNumericValueForFilter = useCallback(
    (row: T, columnId: string): number => {
      if (!valueForSort) return NaN;
      const v = valueForSort(row, columnId);
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    },
    [valueForSort]
  );

  const rowsFiltradas = useMemo(() => {
    const hasFiltros = Object.values(deferredColumnFilters).some((v) => v?.trim());
    if (!hasFiltros) return rows;
    return rows.filter((row) =>
      rowMatchesColumnFilters(
        row,
        deferredColumnFilters,
        getCellText,
        undefined,
        getNumericValueForFilter,
        getCellFilterValues
      )
    );
  }, [rows, deferredColumnFilters, getCellText, getCellFilterValues, getNumericValueForFilter]);

  /** Ordenação rápida pelo menu da coluna (sortState) tem prioridade sobre classificação personalizada (sortLevels). */
  const levelsToUse = useMemo((): SortLevel[] => {
    if (sortState) return [{ id: sortState.key, dir: sortState.direction }];
    if (sortLevels.length > 0) return sortLevels;
    return [];
  }, [sortLevels, sortState]);

  const rowsExibidas = useMemo(() => {
    if (levelsToUse.length === 0) return rowsFiltradas;
    const cmp = compareRows ?? compareRowsBySortLevels;
    return [...rowsFiltradas].sort((a, b) => cmp(a, b, levelsToUse, getSortValue));
  }, [rowsFiltradas, levelsToUse, getSortValue, compareRows]);

  const temFiltrosColuna = useMemo(
    () => Object.values(columnFilters).some((v) => v?.trim()),
    [columnFilters]
  );

  const sortDiferenteDoPadrao =
    sortState != null || !sortLevelsIguais(sortLevels, defaultSortLevels);

  const temFiltrosOuOrdem = temFiltrosColuna || sortDiferenteDoPadrao;

  useEffect(() => {
    if (!persistGradeFilters) return;
    saveGradeFiltrosPedidos({ columnFilters, sortState });
  }, [persistGradeFilters, columnFilters, sortState]);

  const limparFiltrosGrade = useCallback(() => {
    setColumnFilters({});
    setExcelFilterDrafts({});
    setSortState(null);
    setSortLevels([...defaultSortLevels]);
    fecharFiltroExcel();
    if (persistGradeFilters) clearGradeFiltrosPedidos();
  }, [fecharFiltroExcel, defaultSortLevels, persistGradeFilters]);

  /** Confirma ordenação e/ou filtro da coluna (botão OK/Ordenar), sem reaplicar ao editar linhas. */
  const confirmarMenuExcelColuna = useCallback(
    (key: string) => {
      const draft = excelFilterDraftsRef.current[key];
      if (draft?.sortDir) {
        setSortState({ key, direction: draft.sortDir });
        setSortLevels([]);
      }
      const valores = valoresUnicosRef.current[key] ?? [];
      if (draft?.numericOp && draft.numericV1?.trim()) {
        const n1 = parseNumeroFiltroInput(draft.numericV1);
        if (n1 != null) {
          if (draft.numericOp === 'between') {
            const n2 = parseNumeroFiltroInput(draft.numericV2 ?? '');
            if (n2 != null) {
              setFiltroColuna(key, encodeNumericColumnFilter('between', n1, n2));
              fecharFiltroExcel();
              return;
            }
          } else {
            setFiltroColuna(key, encodeNumericColumnFilter(draft.numericOp, n1));
            fecharFiltroExcel();
            return;
          }
        }
      }
      if (!draft || draft.selected.length === 0) {
        setFiltroColuna(key, FILTER_NONE);
      } else if (todosValoresSelecionados(draft.selected, valores)) {
        setFiltroColuna(key, '');
      } else {
        setFiltroColuna(key, draft.selected.join(FILTER_SEP));
      }
      fecharFiltroExcel();
    },
    [setFiltroColuna, fecharFiltroExcel]
  );

  const clearColumnFilter = useCallback((key: string) => {
    setColumnFilters((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setExcelFilterDrafts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const colunaComFiltroAtivo = useCallback(
    (colId: string) => {
      const f = columnFilters[colId]?.trim();
      return Boolean(f && f !== FILTER_NONE) || sortState?.key === colId;
    },
    [columnFilters, sortState]
  );

  return {
    rowsExibidas,
    tableScrollRef,
    filtroDropdownRef,
    columnFilters,
    excelFilterDrafts,
    setExcelFilterDrafts,
    colunaFiltroAberta,
    filtroAbertoRect,
    valoresUnicosPorColuna,
    sortState,
    setSortState,
    sortLevels,
    setSortLevels,
    abrirFiltroExcel,
    fecharFiltroExcel,
    aplicarFiltroExcel,
    confirmarMenuExcelColuna,
    temFiltrosOuOrdem,
    limparFiltrosGrade,
    colunaComFiltroAtivo,
    clearColumnFilter,
  };
}
