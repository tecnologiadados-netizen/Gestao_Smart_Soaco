import { useRef, memo, useState, useMemo, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trash2, Filter, Search, Pencil, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import { Checkbox } from "@rh/components/ui/checkbox";
import { ScrollArea } from "@rh/components/ui/scroll-area";
import type { SancaoDisciplinarRow } from "@rh/types/api";
import { cn } from "@rh/lib/utils";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rh/components/ui/tooltip";
import {
  type SancaoColumnFilter,
  columnUniqueSancaoValues,
  displaySancaoCellFilterLabel,
} from "@rh/pages/FaltasAtestados/sancoes-column-filter";
import { stripMarcaGeradaAusenciaMotivo } from "@rh/pages/FaltasAtestados/suspensao-ausencia-encoding";

const ROW_PX = 42;
const ACTION_COL_PX = 92;
const MIN_COL_PX = 56;
const MAX_COL_PX = 560;
const COL_WIDTHS_LS_KEY = "sancoes-disciplinares-col-widths-v1";

const DEFAULT_COL_PIXELS: Partial<Record<keyof SancaoDisciplinarRow, number>> = {
  matricula: 100,
  nomeFuncionario: 240,
  tipo: 160,
  dataAplicacao: 132,
  mes: 88,
  ano: 72,
  observacoes: 260,
};

type Col = { key: keyof SancaoDisciplinarRow; label: string; listId?: string };

function loadPixelWidths(cols: Col[]): number[] {
  const defaults = cols.map((c) => DEFAULT_COL_PIXELS[c.key] ?? 128);
  try {
    const raw = localStorage.getItem(COL_WIDTHS_LS_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Record<string, number>;
    return cols.map((c, i) => {
      const w = saved[String(c.key)];
      return typeof w === "number" && w >= MIN_COL_PX && w <= MAX_COL_PX ? w : defaults[i];
    });
  } catch {
    return defaults;
  }
}

function persistPixelWidths(cols: Col[], widths: number[]) {
  try {
    const map: Record<string, number> = {};
    cols.forEach((c, i) => {
      map[String(c.key)] = widths[i] ?? DEFAULT_COL_PIXELS[c.key] ?? 128;
    });
    localStorage.setItem(COL_WIDTHS_LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

type Props = {
  columns: Col[];
  sourceRows: SancaoDisciplinarRow[];
  rows: SancaoDisciplinarRow[];
  canEdit?: boolean;
  onEditRow: (id: SancaoDisciplinarRow["id"]) => void;
  onRemoveRow: (id: SancaoDisciplinarRow["id"]) => void;
  maxHeightClass?: string;
  columnFilters: Partial<Record<keyof SancaoDisciplinarRow, SancaoColumnFilter>>;
  onColumnFilterApply: (key: keyof SancaoDisciplinarRow, filter: SancaoColumnFilter) => void;
  sortConfig: { key: keyof SancaoDisciplinarRow; dir: "asc" | "desc" } | null;
  onSortChange: (next: { key: keyof SancaoDisciplinarRow; dir: "asc" | "desc" } | null) => void;
};

function ColumnHeaderExcelFilter({
  col,
  sourceRows,
  committed,
  onApply,
  sortConfig,
  onSortChange,
}: {
  col: Col;
  sourceRows: SancaoDisciplinarRow[];
  committed: SancaoColumnFilter | undefined;
  onApply: (f: SancaoColumnFilter) => void;
  sortConfig: Props["sortConfig"];
  onSortChange: Props["onSortChange"];
}) {
  const [open, setOpen] = useState(false);
  const isDateColumn = col.key === "dataAplicacao";
  const uniques = useMemo(() => columnUniqueSancaoValues(sourceRows, col.key), [sourceRows, col.key]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    if (isDateColumn) {
      if (committed?.kind === "dateRange") {
        setStartDate(committed.start ?? "");
        setEndDate(committed.end ?? "");
      } else {
        setStartDate("");
        setEndDate("");
      }
      return;
    }
    if (!committed || committed.kind === "all") {
      setDraft(new Set(uniques));
    } else {
      const allowed =
        committed.kind === "values" ? committed.allowed.filter((x) => uniques.includes(x)) : uniques;
      setDraft(new Set(allowed.length > 0 ? allowed : uniques));
    }
  }, [open, uniques, committed, isDateColumn]);

  const visible = useMemo(() => {
    if (!search.trim()) return uniques;
    return uniques.filter((v) => textIncludesSearch(displaySancaoCellFilterLabel(v), search));
  }, [uniques, search]);

  const toggle = (v: string) => {
    setDraft((prev) => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  };

  const selectAllVisible = () => {
    setDraft((prev) => {
      const n = new Set(prev);
      for (const v of visible) n.add(v);
      return n;
    });
  };

  const clearVisible = () => {
    setDraft((prev) => {
      const n = new Set(prev);
      for (const v of visible) n.delete(v);
      return n;
    });
  };

  const handleOK = () => {
    if (isDateColumn) {
      const start = startDate || null;
      const end = endDate || null;
      if (!start && !end) {
        onApply({ kind: "all" });
      } else {
        onApply({ kind: "dateRange", start, end });
      }
      setOpen(false);
      return;
    }
    if (draft.size === 0) {
      onApply({ kind: "values", allowed: [] });
      setOpen(false);
      return;
    }
    const allPicked = uniques.length > 0 && uniques.every((u) => draft.has(u));
    if (allPicked) {
      onApply({ kind: "all" });
    } else {
      onApply({ kind: "values", allowed: uniques.filter((u) => draft.has(u)) });
    }
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const active = Boolean(committed && committed.kind !== "all");
  const sortedHere = sortConfig?.key === col.key;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 w-8 flex items-center justify-center border-l border-border/60 hover:bg-muted/90 transition-colors",
            active && "bg-primary/10 text-primary",
            sortedHere && "ring-1 ring-inset ring-primary/40",
          )}
          aria-label={`Filtrar coluna ${col.label}`}
          title="Filtrar por valores"
        >
          <Filter className="w-3.5 h-3.5 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-1.5rem),18.5rem)] p-0 shadow-lg border-border"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-2.5 py-2 border-b border-border bg-muted/40">
          <p className="text-xs font-semibold text-foreground truncate">{col.label}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={() => onSortChange({ key: col.key, dir: "asc" })}
            >
              Classificar A → Z
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={() => onSortChange({ key: col.key, dir: "desc" })}
            >
              Classificar Z → A
            </Button>
            {sortedHere ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2 text-muted-foreground"
                onClick={() => onSortChange(null)}
              >
                Limpar ordenação
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-2.5 py-2 border-b border-border">
          {isDateColumn ? (
            <>
              <p className="text-[11px] font-medium text-foreground mb-1.5">Filtrar por período</p>
              <div className="grid grid-cols-1 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  Data inicial
                  <Input
                    type="date"
                    className="mt-1 h-8 text-xs"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Data final
                  <Input
                    type="date"
                    className="mt-1 h-8 text-xs"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium text-foreground mb-1.5">Filtrar por valores</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                <button type="button" className="text-primary hover:underline" onClick={selectAllVisible}>
                  Selecionar tudo ({visible.length})
                </button>
                <span className="text-muted-foreground">·</span>
                <button type="button" className="text-primary hover:underline" onClick={clearVisible}>
                  Limpar
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Mostrando {visible.length} de {uniques.length} valor(es) distintos
              </p>
              <div className="relative mt-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs"
                  placeholder="Pesquisar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {!isDateColumn ? (
          <ScrollArea className="h-[min(45vh,14rem)]">
            <div className="p-1.5 space-y-0.5 pr-3">
              {visible.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-2">Nenhum valor corresponde à pesquisa.</p>
              ) : (
                visible.map((v) => (
                  <label
                    key={`${col.key}-${v === "" ? "__empty__" : v}`}
                    className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-xs cursor-pointer hover:bg-muted/70"
                  >
                    <Checkbox checked={draft.has(v)} onCheckedChange={() => toggle(v)} />
                    <span className="truncate min-w-0" title={v || "(Vazio)"}>
                      {displaySancaoCellFilterLabel(v)}
                    </span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-2 text-[11px] text-muted-foreground">
            O período aplica somente às datas disponíveis na base carregada.
          </div>
        )}

        <div className="flex justify-end gap-2 p-2 border-t border-border bg-muted/20">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            onClick={handleOK}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function displaySancaoCellText(row: SancaoDisciplinarRow, key: keyof SancaoDisciplinarRow): string {
  const v = row[key];
  if (key === "dataAplicacao") {
    const s = String(v ?? "").trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  if (key === "observacoes") return stripMarcaGeradaAusenciaMotivo(String(v ?? ""));
  return String(v ?? "");
}

function SancaoGridRowInner({
  row,
  rowIdx,
  columns,
  gridTemplateColumns,
  canEdit,
  onEditRow,
  onRemoveRow,
}: {
  row: SancaoDisciplinarRow;
  rowIdx: number;
  columns: Col[];
  gridTemplateColumns: string;
  canEdit: boolean;
  onEditRow: Props["onEditRow"];
  onRemoveRow: Props["onRemoveRow"];
}) {
  const zebra = rowIdx % 2 === 0 ? "bg-card" : "bg-muted/20";
  const motivoTrim = stripMarcaGeradaAusenciaMotivo(String(row.observacoes ?? "")).trim();
  const rowGrid = (
    <div
      className={cn(
        "group grid gap-0 items-stretch border-b border-border cursor-default transition-colors",
        motivoTrim
          ? "border-l-[3px] border-l-sky-500 bg-sky-100/85 dark:bg-sky-950/45 dark:border-l-sky-400 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.12)] hover:bg-sky-200/90 dark:hover:bg-sky-900/55 dark:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]"
          : cn(zebra, "hover:bg-accent/5"),
      )}
      style={{ gridTemplateColumns, minHeight: ROW_PX }}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className="flex items-center min-h-[40px] min-w-0 px-1 py-0.5 border-r border-border"
        >
          {col.key === "dataAplicacao" ? (
            <div className="flex items-center gap-1 min-w-0 w-full px-2">
              {motivoTrim ? (
                <MessageSquare
                  className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                  aria-label="Há motivo registrado"
                />
              ) : null}
              <span className="truncate text-sm tabular-nums">{displaySancaoCellText(row, col.key)}</span>
            </div>
          ) : (
            <span className="truncate w-full px-2 text-sm">{displaySancaoCellText(row, col.key)}</span>
          )}
        </div>
      ))}
      <div className="flex items-center justify-center gap-0.5 border-l border-border bg-inherit shrink-0 px-0.5">
        {canEdit ? (
          <>
            <button
              type="button"
              title="Editar no formulário"
              aria-label="Editar linha"
              onClick={() => onEditRow(row.id)}
              className="shrink-0 p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/80"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemoveRow(row.id)}
              title="Excluir linha"
              aria-label="Excluir linha"
              className="shrink-0 p-1.5 rounded-sm text-destructive/90 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  if (!motivoTrim) return rowGrid;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{rowGrid}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={10}
        collisionPadding={20}
        className={cn(
          "z-[450] max-w-none w-[min(36rem,calc(100vw-1.5rem))] p-0 text-left !overflow-visible shadow-lg border-2",
        )}
      >
        <div className="px-4 py-3.5 max-h-[min(65vh,26rem)] overflow-y-auto overflow-x-hidden rounded-[inherit]">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200 mb-2 pt-0.5">
            Motivo
          </p>
          <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">{motivoTrim}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const SancaoGridRow = memo(SancaoGridRowInner);

export function SancoesDisciplinaresVirtualGrid({
  columns,
  sourceRows,
  rows,
  canEdit = true,
  onEditRow,
  onRemoveRow,
  maxHeightClass = "h-[min(70vh,calc(100vh-280px))] min-h-[320px]",
  columnFilters,
  onColumnFilterApply,
  sortConfig,
  onSortChange,
}: Props) {
  const colSig = useMemo(() => columns.map((c) => c.key).join("|"), [columns]);
  const [pixelWidths, setPixelWidths] = useState<number[]>(() => loadPixelWidths(columns));

  useEffect(() => {
    setPixelWidths(loadPixelWidths(columns));
  }, [colSig, columns]);

  const gridTemplateColumns = useMemo(
    () => [...pixelWidths.map((w) => `${Math.round(w)}px`), `${ACTION_COL_PX}px`].join(" "),
    [pixelWidths],
  );

  const gridMinWidth = useMemo(
    () => pixelWidths.reduce((a, w) => a + w, 0) + ACTION_COL_PX,
    [pixelWidths],
  );

  const widthsRef = useRef(pixelWidths);
  widthsRef.current = pixelWidths;

  const beginColumnResize = useCallback(
    (colIndex: number, startClientX: number) => {
      const startW = widthsRef.current[colIndex] ?? MIN_COL_PX;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startClientX;
        const next = Math.min(MAX_COL_PX, Math.max(MIN_COL_PX, Math.round(startW + delta)));
        setPixelWidths((prev) => {
          const copy = [...prev];
          copy[colIndex] = next;
          return copy;
        });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        persistPixelWidths(columns, widthsRef.current);
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columns],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_PX,
    overscan: 15,
  });

  const items = virtualizer.getVirtualItems();
  const emptyBody = rows.length === 0;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="border border-border rounded-sm bg-card shadow-level-1 overflow-hidden min-w-0">
      {/* Um único overflow-auto: o trackpad envia scroll horizontal + vertical para o mesmo elemento (evita gesto “preso” com overflow-x e overflow-y aninhados). */}
      <div
        ref={parentRef}
        className={cn(
          "overflow-auto overscroll-auto min-w-0 max-w-full touch-auto [scrollbar-gutter:stable]",
          maxHeightClass,
        )}
      >
        <div className="w-max min-w-full" style={{ minWidth: gridMinWidth }}>
          <div
            className="sticky top-0 z-20 grid gap-0 border-b border-border bg-muted/95 backdrop-blur-[2px] shadow-[0_1px_0_0_hsl(var(--border))]"
            style={{ gridTemplateColumns }}
          >
            {columns.map((col, colIndex) => (
              <div key={col.key} className="relative flex items-stretch min-w-0 border-r border-border">
                <span className="flex-1 min-w-0 px-1.5 py-2 text-left label-industrial text-[10px] sm:text-xs leading-tight flex items-center whitespace-normal break-words">
                  {col.label}
                </span>
                <ColumnHeaderExcelFilter
                  col={col}
                  sourceRows={sourceRows}
                  committed={columnFilters[col.key]}
                  onApply={(f) => onColumnFilterApply(col.key, f)}
                  sortConfig={sortConfig}
                  onSortChange={onSortChange}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Ajustar largura da coluna ${col.label}`}
                  title="Arrastar para redimensionar"
                  className="absolute -right-1 top-0 z-30 h-full w-3 cursor-col-resize border-0 p-0 bg-transparent hover:bg-primary/25 active:bg-primary/35 touch-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginColumnResize(colIndex, e.clientX);
                  }}
                />
              </div>
            ))}
            <div
              className="border-l border-border flex items-center justify-center shrink-0 bg-muted/95"
              style={{ width: ACTION_COL_PX }}
              aria-hidden
            />
          </div>
          {emptyBody ? (
            <div className="py-12 text-center text-muted-foreground text-sm border-t border-border">
              Nenhum registro encontrado com os filtros atuais.
            </div>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
                width: gridMinWidth,
                minWidth: gridMinWidth,
              }}
            >
              {items.map((vi) => {
                const row = rows[vi.index];
                if (!row) return null;
                return (
                  <div
                    key={String(row.id)}
                    className="absolute left-0 top-0"
                    style={{
                      height: vi.size,
                      width: gridMinWidth,
                      minWidth: gridMinWidth,
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <SancaoGridRow
                      row={row}
                      rowIdx={vi.index}
                      columns={columns}
                      gridTemplateColumns={gridTemplateColumns}
                      canEdit={canEdit}
                      onEditRow={onEditRow}
                      onRemoveRow={onRemoveRow}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
