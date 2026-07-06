"use client";

import type { MouseEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ColumnSortState } from "@/lib/utils/table-sort";

interface SortableTableHeadProps<K extends string> {
  sortKey: K;
  sortState: ColumnSortState | null;
  onSort: (key: K, event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

function SortIndicator({ sortState }: { sortState: ColumnSortState | null }) {
  if (!sortState) {
    return (
      <ArrowUpDown
        className="size-3.5 shrink-0 opacity-45"
        aria-hidden="true"
      />
    );
  }

  const Icon = sortState.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {sortState.total > 1 ? (
        <span className="text-[10px] font-bold leading-none tabular-nums opacity-90">
          {sortState.priority}
        </span>
      ) : null}
    </span>
  );
}

export function SortableTableHead<K extends string>({
  sortKey,
  sortState,
  onSort,
  children,
  align = "left",
  className,
}: SortableTableHeadProps<K>) {
  const ariaSort =
    sortState?.direction === "asc"
      ? "ascending"
      : sortState?.direction === "desc"
        ? "descending"
        : "none";

  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "-mx-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors",
          "hover:bg-table-header-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          align === "right" && "ml-auto text-right",
          align === "center" && "mx-auto text-center",
          sortState && "text-table-header-foreground"
        )}
        onClick={(event) => onSort(sortKey, event)}
        title="Clique para ordenar. Ctrl+clique para ordenação múltipla."
      >
        <span className="truncate">{children}</span>
        <SortIndicator sortState={sortState} />
      </button>
    </TableHead>
  );
}
