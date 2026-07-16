import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Filter, X } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Input } from "@rh/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rh/components/ui/table";
import { attachDialogSafeWheelScroll } from "@rh/lib/scroll-container-wheel";
import { cn } from "@rh/lib/utils";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import type { OrganicoImportChangeLogEntry } from "./organico-import-change-log";

export type ChangeLogColumnKey = keyof Pick<
  OrganicoImportChangeLogEntry,
  "colaboradorNome" | "setor" | "colunaAlterada" | "antes" | "depois"
>;

type ColumnFilter = { kind: "all" } | { kind: "values"; allowed: string[] };

type SortRule = { column: ChangeLogColumnKey; direction: "asc" | "desc" };

const COLUMNS: { key: ChangeLogColumnKey; label: string; width: string }[] = [
  { key: "colaboradorNome", label: "Nome do colaborador", width: "w-[22%]" },
  { key: "setor", label: "Setor", width: "w-[14%]" },
  { key: "colunaAlterada", label: "Coluna alterada", width: "w-[18%]" },
  { key: "antes", label: "Antes", width: "w-[23%]" },
  { key: "depois", label: "Depois", width: "w-[23%]" },
];

function cellValue(entry: OrganicoImportChangeLogEntry, key: ChangeLogColumnKey): string {
  return String(entry[key] ?? "").trim();
}

function uniqueColumnValues(entries: OrganicoImportChangeLogEntry[], key: ChangeLogColumnKey): string[] {
  const set = new Set<string>();
  for (const e of entries) set.add(cellValue(e, key));
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
}

function matchesColumnFilter(value: string, filter: ColumnFilter | undefined): boolean {
  if (!filter || filter.kind === "all") return true;
  if (filter.allowed.length === 0) return false;
  return filter.allowed.includes(value);
}

function compareValues(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

function sortMeta(rules: SortRule[], column: ChangeLogColumnKey): { direction?: "asc" | "desc"; priority?: number } {
  const idx = rules.findIndex((r) => r.column === column);
  if (idx < 0) return {};
  return { direction: rules[idx]!.direction, priority: idx + 1 };
}

function ChangeLogColumnHeader({
  column,
  label,
  sourceEntries,
  filter,
  onFilterApply,
  sortRules,
  onSortClick,
}: {
  column: ChangeLogColumnKey;
  label: string;
  sourceEntries: OrganicoImportChangeLogEntry[];
  filter: ColumnFilter | undefined;
  onFilterApply: (f: ColumnFilter) => void;
  sortRules: SortRule[];
  onSortClick: (column: ChangeLogColumnKey, multi: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listScrollRef = useRef<HTMLDivElement>(null);
  const uniques = useMemo(() => uniqueColumnValues(sourceEntries, column), [sourceEntries, column]);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      const el = listScrollRef.current;
      if (el) cleanup = attachDialogSafeWheelScroll(el, "vertical");
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    if (!filter || filter.kind === "all") {
      setDraft(new Set(uniques));
    } else {
      const allowed = filter.allowed.filter((x) => uniques.includes(x));
      setDraft(new Set(allowed.length > 0 ? allowed : uniques));
    }
  }, [open, uniques, filter]);

  const visible = useMemo(() => {
    if (!search.trim()) return uniques;
    return uniques.filter((v) => textIncludesSearch(v || "(Vazio)", search));
  }, [uniques, search]);

  const active = Boolean(filter && filter.kind !== "all");
  const { direction, priority } = sortMeta(sortRules, column);

  const handleOk = () => {
    if (draft.size === 0) {
      onFilterApply({ kind: "values", allowed: [] });
    } else if (uniques.every((u) => draft.has(u))) {
      onFilterApply({ kind: "all" });
    } else {
      onFilterApply({ kind: "values", allowed: uniques.filter((u) => draft.has(u)) });
    }
    setOpen(false);
  };

  return (
    <div className="flex items-stretch gap-0 min-h-9">
      <button
        type="button"
        className={cn(
          "flex flex-1 items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted/60 transition-colors select-none",
          direction && "text-primary",
        )}
        onClick={(e) => onSortClick(column, e.ctrlKey || e.metaKey)}
        title="Clique para ordenar. Ctrl+clique para ordenação múltipla."
      >
        <span className="break-words leading-tight">{label}</span>
        {direction ? (
          <span className="inline-flex items-center gap-0.5 shrink-0 text-primary">
            {direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {priority && priority > 1 ? <span className="text-[10px]">({priority})</span> : null}
          </span>
        ) : null}
      </button>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "shrink-0 w-8 flex items-center justify-center border-l border-border/60 hover:bg-muted/90",
              active && "bg-primary/10 text-primary",
            )}
            aria-label={`Filtrar ${label}`}
            title="Filtrar por valores"
          >
            <Filter className="h-3.5 w-3.5 opacity-80" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="z-[60] w-[min(calc(100vw-1.5rem),18.5rem)] p-0" align="start" side="bottom">
          <div className="px-2.5 py-2 border-b border-border bg-muted/40">
            <p className="text-xs font-semibold truncate">{label}</p>
          </div>
          <div className="px-2.5 py-2 border-b border-border">
            <Input
              placeholder="Buscar valor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="mt-2 flex gap-1">
              <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => setDraft(new Set(visible))}>
                Marcar visíveis
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => {
                setDraft((prev) => {
                  const n = new Set(prev);
                  for (const v of visible) n.delete(v);
                  return n;
                });
              }}>
                Desmarcar visíveis
              </Button>
            </div>
          </div>
          <div
            ref={listScrollRef}
            className="max-h-52 overflow-y-auto overscroll-contain px-2 py-1.5 space-y-0.5 touch-auto"
          >
            {visible.map((v) => {
              const id = `clog-f-${column}-${v}`;
              const labelText = v === "" ? "(Vazio)" : v;
              return (
                <label key={v || "__empty__"} htmlFor={id} className="flex items-start gap-2 text-xs py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                  <Checkbox
                    id={id}
                    checked={draft.has(v)}
                    onCheckedChange={(checked) => {
                      setDraft((prev) => {
                        const n = new Set(prev);
                        if (checked) n.add(v);
                        else n.delete(v);
                        return n;
                      });
                    }}
                    className="mt-0.5"
                  />
                  <span className="break-all leading-snug">{labelText}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-1.5 px-2.5 py-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-8" onClick={handleOk}>
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function OrganicoImportChangeLogTable({
  entries,
  globalFilter = "",
  resetKey,
}: {
  entries: OrganicoImportChangeLogEntry[];
  globalFilter?: string;
  /** Troca ao carregar novo arquivo — zera filtros/ordenação. */
  resetKey?: string;
}) {
  const [columnFilters, setColumnFilters] = useState<Partial<Record<ChangeLogColumnKey, ColumnFilter>>>({});
  const [sortRules, setSortRules] = useState<SortRule[]>([]);

  useEffect(() => {
    setColumnFilters({});
    setSortRules([]);
  }, [resetKey]);

  const handleSortClick = (column: ChangeLogColumnKey, multi: boolean) => {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.column === column);
      const nextDir = idx >= 0 ? (prev[idx]!.direction === "asc" ? "desc" : "asc") : "asc";
      if (!multi) return [{ column, direction: nextDir }];
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { column, direction: nextDir };
        return next;
      }
      return [...prev, { column, direction: "asc" }];
    });
  };

  const globallyFiltered = useMemo(() => {
    if (!globalFilter.trim()) return entries;
    return entries.filter(
      (e) =>
        textIncludesSearch(e.colaboradorNome, globalFilter) ||
        textIncludesSearch(e.setor, globalFilter) ||
        textIncludesSearch(e.colunaAlterada, globalFilter) ||
        textIncludesSearch(e.antes, globalFilter) ||
        textIncludesSearch(e.depois, globalFilter),
    );
  }, [entries, globalFilter]);

  const displayed = useMemo(() => {
    let rows = globallyFiltered.filter((row) =>
      COLUMNS.every((col) => matchesColumnFilter(cellValue(row, col.key), columnFilters[col.key])),
    );
    if (sortRules.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const rule of sortRules) {
          const cmp = compareValues(cellValue(a, rule.column), cellValue(b, rule.column), rule.direction);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    return rows;
  }, [globallyFiltered, columnFilters, sortRules]);

  const hasActiveFilters = Object.values(columnFilters).some((f) => f && f.kind !== "all");

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhuma alteração detectada em relação à base atual.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Exibindo {displayed.length} de {entries.length} alteração(ões)
          {sortRules.length > 0 ? " · Ctrl+clique no cabeçalho para ordenação múltipla" : " · Clique no cabeçalho para ordenar"}
        </span>
        {(hasActiveFilters || sortRules.length > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setColumnFilters({});
              setSortRules([]);
            }}
          >
            <X className="h-3 w-3" />
            Limpar filtros e ordenação
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table className="min-w-[1100px] w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={cn("p-0 align-bottom", col.width)}>
                  <ChangeLogColumnHeader
                    column={col.key}
                    label={col.label}
                    sourceEntries={globallyFiltered}
                    filter={columnFilters[col.key]}
                    onFilterApply={(f) =>
                      setColumnFilters((prev) => {
                        const next = { ...prev };
                        if (f.kind === "all") delete next[col.key];
                        else next[col.key] = f;
                        return next;
                      })
                    }
                    sortRules={sortRules}
                    onSortClick={handleSortClick}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma linha corresponde aos filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              displayed.map((entry, i) => (
                <TableRow key={`${entry.matricula}-${entry.colIndex}-${i}`}>
                  <TableCell className="align-top font-medium break-words">{entry.colaboradorNome}</TableCell>
                  <TableCell className="align-top break-words">{entry.setor}</TableCell>
                  <TableCell className="align-top break-words">{entry.colunaAlterada}</TableCell>
                  <TableCell className="align-top break-words text-muted-foreground" title={entry.antes}>
                    {entry.antes}
                  </TableCell>
                  <TableCell className="align-top break-words" title={entry.depois}>
                    {entry.depois}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
