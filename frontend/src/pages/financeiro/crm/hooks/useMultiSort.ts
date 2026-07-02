import { useCallback, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortColumn<T> {
  id: string;
  getValue: (item: T) => string | number | null | undefined;
}

export interface SortRule {
  id: string;
  direction: SortDirection;
}

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function useMultiSort<T>(
  data: T[],
  columns: Record<string, SortColumn<T>>,
  defaultRules: SortRule[],
) {
  const [sortRules, setSortRules] = useState<SortRule[]>(defaultRules);

  const handleSort = useCallback((columnId: string, multi: boolean) => {
    setSortRules((current) => {
      const existingIndex = current.findIndex((rule) => rule.id === columnId);

      if (multi) {
        if (existingIndex >= 0) {
          const existing = current[existingIndex];
          if (existing.direction === "asc") {
            const next = [...current];
            next[existingIndex] = { id: columnId, direction: "desc" };
            return next;
          }
          return current.filter((rule) => rule.id !== columnId);
        }
        return [...current, { id: columnId, direction: "asc" }];
      }

      if (existingIndex >= 0 && current.length === 1) {
        return [
          {
            id: columnId,
            direction: current[0].direction === "asc" ? "desc" : "asc",
          },
        ];
      }

      return [{ id: columnId, direction: "asc" }];
    });
  }, []);

  const sortedData = useMemo(() => {
    if (sortRules.length === 0) return data;

    return [...data].sort((left, right) => {
      for (const rule of sortRules) {
        const column = columns[rule.id];
        if (!column) continue;

        const result = compareValues(
          column.getValue(left),
          column.getValue(right),
        );

        if (result !== 0) {
          return rule.direction === "asc" ? result : -result;
        }
      }

      return 0;
    });
  }, [columns, data, sortRules]);

  const getSortMeta = useCallback(
    (columnId: string) => {
      const index = sortRules.findIndex((rule) => rule.id === columnId);
      if (index < 0) return null;
      return {
        index,
        direction: sortRules[index].direction,
        priority: sortRules.length > 1 ? index + 1 : null,
      };
    },
    [sortRules],
  );

  return {
    sortedData,
    sortRules,
    handleSort,
    getSortMeta,
  };
}
