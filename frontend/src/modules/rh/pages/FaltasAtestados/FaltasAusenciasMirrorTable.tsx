import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import { getFaltasAtestados } from "@rh/lib/api-client";
import { useToast } from "@rh/hooks/use-toast";
import type { FaltaRow } from "@rh/types/api";
import { FaltaAusenciasVirtualGrid } from "@rh/pages/FaltasAtestados/FaltasAusenciasVirtualGrid";
import { ColumnVisibilityPopover } from "@rh/pages/FaltasAtestados/ColumnVisibilityPopover";
import {
  ALL_COLUMNS,
  HIDDEN_COLUMNS_LS_KEY,
  faltaRowColaboradorKey,
  loadHiddenColumns,
} from "@rh/pages/FaltasAtestados/faltas-ausencias-columns";
import {
  type FaltaColumnFilter,
  rowMatchesColumnFilter,
} from "@rh/pages/FaltasAtestados/faltas-column-filter";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";

type Props = {
  /** Linhas já no mesmo recorte do dashboard (período, filtros, tipos de ausência etc.). */
  rowsScope: FaltaRow[];
  /** Se não nulo, restringe às ausências deste colaborador (`matricula|||nome`). */
  colaboradorKey: string | null;
  /** Reservado (ex.: fechar diálogo no pai); a tabela não remove mais o filtro de colaborador por botão. */
  onColaboradorKeyChange?: (next: string | null) => void;
  colaboradorNomeCurto?: string;
};

const noop = () => {};

export function FaltasAusenciasMirrorTable({
  rowsScope,
  colaboradorKey,
  colaboradorNomeCurto,
}: Props) {
  const { toast } = useToast();
  const [historicoCompleto, setHistoricoCompleto] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof FaltaRow, FaltaColumnFilter>>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Array<keyof FaltaRow>>(() => loadHiddenColumns());
  const deferredColFilters = useDeferredValue(columnFilters);
  const [sortConfig, setSortConfig] = useState<{ key: keyof FaltaRow; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    setHistoricoCompleto(false);
  }, [colaboradorKey]);

  const {
    data: todasFaltasSistema,
    isFetching: carregandoHistorico,
    isError: erroHistorico,
    isFetched: historicoFetched,
  } = useQuery({
    queryKey: ["faltas-atestados", "mirror-historico-completo"],
    queryFn: () => getFaltasAtestados(),
    enabled: historicoCompleto && Boolean(colaboradorKey),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!historicoCompleto || !historicoFetched || !erroHistorico) return;
    toast({
      title: "Não foi possível carregar o histórico",
      description: "Tente de novo ou abra a aba Faltas e Atestados.",
      variant: "destructive",
    });
  }, [historicoCompleto, historicoFetched, erroHistorico, toast]);

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns],
  );

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_COLUMNS_LS_KEY, JSON.stringify(hiddenColumns));
    } catch {
      /* ignore */
    }
  }, [hiddenColumns]);

  const afterColaborador = useMemo(() => {
    if (!colaboradorKey) return rowsScope;
    if (historicoCompleto && Array.isArray(todasFaltasSistema)) {
      return todasFaltasSistema.filter((r) => faltaRowColaboradorKey(r) === colaboradorKey);
    }
    return rowsScope.filter((r) => faltaRowColaboradorKey(r) === colaboradorKey);
  }, [rowsScope, colaboradorKey, historicoCompleto, todasFaltasSistema]);

  const applyClientFilters = useCallback(
    (rows: FaltaRow[]) =>
      rows.filter((row) => {
        if (deferredSearch.trim()) {
          if (
            !textIncludesSearch(row.nomeFuncionario, deferredSearch) &&
            !textIncludesSearch(row.matricula, deferredSearch)
          ) {
            return false;
          }
        }
        for (const col of visibleColumns) {
          if (!rowMatchesColumnFilter(row, col.key, deferredColFilters[col.key])) return false;
        }
        return true;
      }),
    [deferredSearch, deferredColFilters, visibleColumns],
  );

  const filtered = useMemo(() => {
    let rows = applyClientFilters(afterColaborador);
    if (sortConfig) {
      const k = sortConfig.key;
      const d = sortConfig.dir;
      rows = [...rows].sort((a, b) => {
        const va = String(a[k] ?? "").trim();
        const vb = String(b[k] ?? "").trim();
        const c = va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" });
        return d === "asc" ? c : -c;
      });
    }
    return rows;
  }, [afterColaborador, applyClientFilters, sortConfig]);

  const verTodasAusenciasColaboradorNoSistema = useCallback(() => {
    setHistoricoCompleto(true);
    setSearch("");
    setColumnFilters({});
    setSortConfig(null);
  }, []);

  const voltarRecortePainel = useCallback(() => {
    setHistoricoCompleto(false);
    setSearch("");
    setColumnFilters({});
    setSortConfig(null);
  }, []);

  const onColumnFilterApply = useCallback((key: keyof FaltaRow, filter: FaltaColumnFilter) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter.kind === "all") delete next[key];
      else next[key] = filter;
      return next;
    });
  }, []);

  const handleHiddenColumnsChange = useCallback((next: string[]) => {
    const normalized = next.filter((key): key is keyof FaltaRow => ALL_COLUMNS.some((column) => column.key === key));
    setHiddenColumns(normalized);
    setColumnFilters((prev) => {
      const updated = { ...prev };
      for (const key of normalized) {
        delete updated[key];
      }
      return updated;
    });
    setSortConfig((prev) => (prev && normalized.includes(prev.key) ? null : prev));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {colaboradorKey ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={carregandoHistorico}
                title="Carrega todas as ausências deste colaborador em Faltas e Atestados (sem limite de período do painel) e limpa filtros da tabela."
                onClick={verTodasAusenciasColaboradorNoSistema}
              >
                {carregandoHistorico ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Carregando…
                  </>
                ) : (
                  "Ver todas as ausências deste colaborador"
                )}
              </Button>
              {historicoCompleto && !carregandoHistorico ? (
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={voltarRecortePainel}>
                  Voltar ao recorte do painel
                </Button>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Exibindo todos os colaboradores neste recorte ({formatIntPt(rowsScope.length)} lançamento(s)).
            </span>
          )}
          <ColumnVisibilityPopover
            columns={ALL_COLUMNS}
            hiddenKeys={hiddenColumns}
            onHiddenKeysChange={handleHiddenColumnsChange}
            title="Colunas da tabela de ausências"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatIntPt(filtered.length)} visível(is) · {formatIntPt(afterColaborador.length)} lançamento(s)
          {historicoCompleto && Array.isArray(todasFaltasSistema) ? " · histórico completo" : colaboradorKey ? " · recorte do painel" : ""}
          {colaboradorKey && colaboradorNomeCurto ? (
            <>
              {" "}
              · <span className="font-medium text-foreground">{colaboradorNomeCurto}</span>
            </>
          ) : null}
        </p>
      </div>

      {erroHistorico && historicoCompleto ? (
        <p className="text-xs text-destructive">Não foi possível buscar todas as ausências. Verifique a API.</p>
      ) : null}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Nome ou matrícula…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <FaltaAusenciasVirtualGrid
        columns={visibleColumns}
        sourceRows={colaboradorKey ? afterColaborador : rowsScope}
        rows={filtered}
        canEdit={false}
        onEditRow={noop}
        maxHeightClass="h-[min(62vh,520px)] min-h-[280px]"
        columnFilters={columnFilters}
        onColumnFilterApply={onColumnFilterApply}
        sortConfig={sortConfig}
        onSortChange={setSortConfig}
      />
    </div>
  );
}

function formatIntPt(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}
