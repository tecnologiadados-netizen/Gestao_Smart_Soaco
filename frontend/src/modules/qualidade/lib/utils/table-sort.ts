export type SortDirection = "asc" | "desc";

export interface TableSortRule<T extends string = string> {
  key: T;
  direction: SortDirection;
}

export function compareSortValues(
  a: unknown,
  b: unknown,
  direction: SortDirection
): number {
  const factor = direction === "asc" ? 1 : -1;

  if (a == null && b == null) return 0;
  if (a == null) return 1 * factor;
  if (b == null) return -1 * factor;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * factor;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * factor;
  }

  return (
    String(a).localeCompare(String(b), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }) * factor
  );
}

export function sortByRules<T, K extends string>(
  items: readonly T[],
  rules: readonly TableSortRule<K>[],
  getValue: (item: T, key: K) => unknown
): T[] {
  if (rules.length === 0) {
    return [...items];
  }

  return [...items].sort((left, right) => {
    for (const rule of rules) {
      const comparison = compareSortValues(
        getValue(left, rule.key),
        getValue(right, rule.key),
        rule.direction
      );
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });
}

export interface ColumnSortState {
  direction: SortDirection;
  priority: number;
  total: number;
}

export function getColumnSortState<K extends string>(
  sorts: readonly TableSortRule<K>[],
  key: K
): ColumnSortState | null {
  const index = sorts.findIndex((rule) => rule.key === key);
  if (index < 0) {
    return null;
  }

  return {
    direction: sorts[index].direction,
    priority: index + 1,
    total: sorts.length,
  };
}

export function toggleTableSort<K extends string>(
  sorts: readonly TableSortRule<K>[],
  key: K,
  multi: boolean
): TableSortRule<K>[] {
  const index = sorts.findIndex((rule) => rule.key === key);

  if (multi) {
    if (index >= 0) {
      const current = sorts[index];
      if (current.direction === "asc") {
        return sorts.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, direction: "desc" } : rule
        );
      }
      return sorts.filter((_, ruleIndex) => ruleIndex !== index);
    }
    return [...sorts, { key, direction: "asc" }];
  }

  if (index >= 0 && sorts.length === 1) {
    return [
      {
        key,
        direction: sorts[index].direction === "asc" ? "desc" : "asc",
      },
    ];
  }

  return [{ key, direction: "asc" }];
}
