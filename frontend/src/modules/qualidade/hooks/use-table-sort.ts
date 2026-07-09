import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import {
  getColumnSortState,
  toggleTableSort,
  type ColumnSortState,
  type TableSortRule,
} from "@qualidade/lib/utils/table-sort";

export function useTableSort<K extends string>(
  initialSorts: TableSortRule<K>[] = []
) {
  const [sorts, setSorts] = useState<TableSortRule<K>[]>(initialSorts);

  const toggleSort = useCallback((key: K, event?: MouseEvent) => {
    const multi = Boolean(event?.ctrlKey || event?.metaKey);
    setSorts((current) => toggleTableSort(current, key, multi));
  }, []);

  const getSortState = useCallback(
    (key: K): ColumnSortState | null => getColumnSortState(sorts, key),
    [sorts]
  );

  const clearSorts = useCallback(() => {
    setSorts([]);
  }, []);

  return {
    sorts,
    setSorts,
    toggleSort,
    getSortState,
    clearSorts,
  };
}
