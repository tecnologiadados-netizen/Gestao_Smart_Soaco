import { useState, useCallback, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import { Badge } from "@rh/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rh/components/ui/alert-dialog";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { ScrollArea } from "@rh/components/ui/scroll-area";
import { Plus, Search, Upload, Download, CalendarRange, ChevronDown, RefreshCw } from "lucide-react";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import {
  getSancoesDisciplinares,
  getSancoesDisciplinaresMonthList,
  getOrganico,
  getFaltasCadastros,
  replaceSancoesDisciplinares,
  isApiConfigured,
} from "@rh/lib/api-client";
import type { SancaoDisciplinarRow, SancaoDisciplinarReplaceRow } from "@rh/types/api";
import { useSancoesDisciplinaresExcel } from "@rh/pages/FaltasAtestados/useSancoesDisciplinaresExcel";
import { SancoesDisciplinaresVirtualGrid } from "@rh/pages/FaltasAtestados/SancoesDisciplinaresVirtualGrid";
import { LancarSancaoDialog } from "@rh/pages/FaltasAtestados/LancarSancaoDialog";
import { ColumnVisibilityPopover } from "@rh/pages/FaltasAtestados/ColumnVisibilityPopover";
import {
  type SancaoColumnFilter,
  rowMatchesSancaoColumnFilter,
} from "@rh/pages/FaltasAtestados/sancoes-column-filter";
import { cn } from "@rh/lib/utils";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import {
  readFaltasSancoesFilters,
  writeFaltasSancoesFilters,
} from "@rh/pages/FaltasAtestados/faltas-ui-filters-persistence";
import { syncSuspensaoAusenciasParaSancoesPadrao } from "@rh/pages/FaltasAtestados/sync-suspensao-ausencia-to-sancoes";
import { shouldMergeVisibleRowIntoServerSnapshot } from "@rh/pages/FaltasAtestados/faltas-save-merge";
import { isLaunchDocAttachmentEnabled, isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import { mergeTestSancoesIntoRows, upsertTestSancaoRow } from "@rh/lib/launch-document-test-records";
import { resolveDocumentCategoryOptions } from "@rh/lib/organico-documents";
import {
  buildSancaoAttachmentIndex,
  buildSancaoAttachmentResolveItems,
  mergeAusenciaAttachmentIndex,
} from "@rh/lib/launch-document-access";
import { LAUNCH_DOC_LINKS_CHANGED_EVENT } from "@rh/lib/launch-document-links";
import { LAUNCH_DOC_QUEUE_CHANGED_EVENT } from "@rh/lib/launch-document-queue";
import { resolveLaunchDocuments } from "@rh/lib/organico-documents-api";

const DASHBOARD_SANCOES_UPDATED_EVENT = "rh-dashboard-sancoes-updated";

function notifyDashboardSancoesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_SANCOES_UPDATED_EVENT));
}

const ALL_COLUMNS: { key: keyof SancaoDisciplinarRow; label: string }[] = [
  { key: "matricula", label: "ID" },
  { key: "nomeFuncionario", label: "NOME" },
  { key: "tipo", label: "TIPO" },
  { key: "dataAplicacao", label: "DATA DA APLICAÇÃO" },
  { key: "mes", label: "MÊS" },
  { key: "ano", label: "ANO" },
  { key: "observacoes", label: "MOTIVO" },
];
const HIDDEN_COLUMNS_LS_KEY = "sancoes-disciplinares-hidden-columns-v1";

function loadHiddenColumns(): Array<keyof SancaoDisciplinarRow> {
  try {
    const raw = localStorage.getItem(HIDDEN_COLUMNS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(ALL_COLUMNS.map((column) => column.key));
    const normalized = parsed.filter(
      (item): item is keyof SancaoDisciplinarRow => typeof item === "string" && allowed.has(item as keyof SancaoDisciplinarRow),
    );
    return normalized.length >= ALL_COLUMNS.length ? [] : normalized;
  } catch {
    return [];
  }
}

function ymKey(d: Date) {
  return format(d, "yyyy-MM");
}

function labelMes(ym: string) {
  try {
    return format(parseISO(`${ym}-01`), "MMMM yyyy", { locale: ptBR });
  } catch {
    return ym;
  }
}

function sortYmAsc(a: string, b: string) {
  return a.localeCompare(b, "en-CA");
}

function mesAnoFromDataAplicacao(iso: string): { mes: string; ano: string } {
  const s = String(iso ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { mes: "", ano: "" };
  try {
    const d = parseISO(s);
    return { mes: format(d, "LLL.", { locale: ptBR }), ano: format(d, "yyyy") };
  } catch {
    return { mes: "", ano: "" };
  }
}

function rowToReplacePayload(row: SancaoDisciplinarRow): SancaoDisciplinarReplaceRow {
  const { id: _id, ...rest } = row;
  return rest;
}

function stripEmptyRows(rows: SancaoDisciplinarRow[]): SancaoDisciplinarRow[] {
  return rows.filter((r) => {
    const hasDate = Boolean(r.dataAplicacao && String(r.dataAplicacao).trim());
    const hasOther =
      r.matricula.trim() ||
      r.nomeFuncionario.trim() ||
      r.tipo.trim() ||
      r.mes.trim() ||
      r.ano.trim() ||
      r.observacoes.trim();
    return hasDate || hasOther;
  });
}

function isProvisionalSancaoId(id: SancaoDisciplinarRow["id"]): boolean {
  const s = String(id);
  return s.startsWith("temp-") || s.startsWith("import-");
}

/** Motivo obrigatório só para lançamentos novos/importados; registros já no banco podem ser legados sem motivo. */
function rowFailsSancaoMotivoRule(row: SancaoDisciplinarRow): boolean {
  if (String(row.observacoes ?? "").trim()) return false;
  return isProvisionalSancaoId(row.id);
}

function rowInvalidForSancaoReplace(row: SancaoDisciplinarRow): boolean {
  if (!row.dataAplicacao || !String(row.dataAplicacao).trim()) return true;
  return rowFailsSancaoMotivoRule(row);
}

function normalizeSancaoRowFromApi(r: SancaoDisciplinarRow, fallbackIndex: number): SancaoDisciplinarRow {
  const id = typeof r.id === "string" && r.id.length > 0 ? r.id : fallbackIndex + 1;
  const dataStr = String(r.dataAplicacao ?? "").trim().slice(0, 10);
  let mes = String(r.mes ?? "").trim();
  let ano = String(r.ano ?? "").trim();
  if ((!mes || !ano) && /^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const d = mesAnoFromDataAplicacao(dataStr);
    if (!mes) mes = d.mes;
    if (!ano) ano = d.ano;
  }
  return {
    ...r,
    id,
    dataAplicacao: dataStr,
    mes,
    ano,
    observacoes: r.observacoes ?? "",
  };
}

/** Mescla snapshot completo do servidor com a grade. `fullServer` deve ser a lista inteira (ver merge em faltas). */
function mergeSancoeRowsForSave(
  fullServer: SancaoDisciplinarRow[],
  visibleRows: SancaoDisciplinarRow[],
  deletedIds: Set<string>,
): SancaoDisciplinarRow[] {
  const map = new Map<string, SancaoDisciplinarRow>();
  for (const r of fullServer) {
    map.set(String(r.id), { ...r, id: r.id });
  }
  const serverIds = new Set(map.keys());
  for (const id of deletedIds) {
    map.delete(id);
  }
  for (const row of stripEmptyRows(visibleRows)) {
    const key = String(row.id);
    if (!shouldMergeVisibleRowIntoServerSnapshot(key, serverIds)) continue;
    map.set(key, row);
  }
  return [...map.values()];
}

export default function SancoesDisciplinaresTab({ canEdit = true }: { canEdit?: boolean }) {
  const queryClient = useQueryClient();
  const { runWithSaving } = useSavingOverlay();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const { parseFile, exportToExcel } = useSancoesDisciplinaresExcel();
  const savedFilters = readFaltasSancoesFilters();
  const launchAttachmentsEnabled = isLaunchDocAttachmentEnabled();
  const [sancaoAttachments, setSancaoAttachments] = useState(() => buildSancaoAttachmentIndex());

  useEffect(() => {
    if (!launchAttachmentsEnabled) return;
    const refresh = () => setSancaoAttachments(buildSancaoAttachmentIndex());
    refresh();
    window.addEventListener(LAUNCH_DOC_QUEUE_CHANGED_EVENT, refresh);
    window.addEventListener(LAUNCH_DOC_LINKS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(LAUNCH_DOC_QUEUE_CHANGED_EVENT, refresh);
      window.removeEventListener(LAUNCH_DOC_LINKS_CHANGED_EVENT, refresh);
    };
  }, [launchAttachmentsEnabled]);

  const defaultMonth = useMemo(() => ymKey(new Date()), []);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    () => savedFilters.selectedMonths ?? [defaultMonth],
  );
  const monthsQueryKey = useMemo(() => [...selectedMonths].sort().join("|"), [selectedMonths]);
  const didFixDefaultMonthRef = useRef(false);

  const { data: availableMonths = [], isLoading: monthsMetaLoading } = useQuery({
    queryKey: ["sancoes-disciplinares-months-meta"],
    queryFn: getSancoesDisciplinaresMonthList,
  });

  const { data: apiData, isLoading, isError, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["sancoes-disciplinares", monthsQueryKey],
    queryFn: () => getSancoesDisciplinares([...selectedMonths].sort()),
    enabled: selectedMonths.length > 0,
    placeholderData: keepPreviousData,
  });

  const [data, setData] = useState<SancaoDisciplinarRow[]>([]);
  const [search, setSearch] = useState(() => savedFilters.search ?? "");
  const deferredSearch = useDeferredValue(search);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof SancaoDisciplinarRow, SancaoColumnFilter>>>(
    () => savedFilters.columnFilters ?? {},
  );
  const [hiddenColumns, setHiddenColumns] = useState<Array<keyof SancaoDisciplinarRow>>(() => loadHiddenColumns());
  const deferredColFilters = useDeferredValue(columnFilters);
  const [monthPopoverOpen, setMonthPopoverOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof SancaoDisciplinarRow; dir: "asc" | "desc" } | null>(
    () => savedFilters.sortConfig ?? null,
  );
  const [lancarOpen, setLancarOpen] = useState(false);
  const [reconcileAutosOpen, setReconcileAutosOpen] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [editInitialRow, setEditInitialRow] = useState<SancaoDisciplinarRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SancaoDisciplinarRow | null>(null);
  const dataRef = useRef<SancaoDisciplinarRow[]>([]);
  const { toast } = useToast();
  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns],
  );

  const { data: organicoRows = [] } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
    staleTime: 60_000,
    enabled: lancarOpen,
  });

  const { data: cadastroFaltas } = useQuery({
    queryKey: ["faltas-cadastros"],
    queryFn: getFaltasCadastros,
    staleTime: 60_000,
  });

  const tiposSancaoOptions = useMemo(() => {
    const items = cadastroFaltas?.tiposSancoes ?? [];
    return [...items]
      .map((x) => x.valor.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [cadastroFaltas]);

  const documentCategoryOptions = useMemo(
    () => resolveDocumentCategoryOptions(cadastroFaltas?.categoriasDocumentos),
    [cadastroFaltas?.categoriasDocumentos],
  );

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_COLUMNS_LS_KEY, JSON.stringify(hiddenColumns));
    } catch {
      /* ignore */
    }
  }, [hiddenColumns]);

  useEffect(() => {
    writeFaltasSancoesFilters({
      search,
      columnFilters,
      selectedMonths,
      sortConfig,
    });
  }, [search, columnFilters, selectedMonths, sortConfig]);

  const fetchServerRowsForMerge = useCallback(async (): Promise<SancaoDisciplinarRow[]> => getSancoesDisciplinares(), []);

  const registeredMonths = useMemo(() => {
    const sortAsc = (a: string, b: string) => a.localeCompare(b, "en-CA");
    const api = [...availableMonths].sort(sortAsc);
    if (api.length > 0) return api;
    const fromData = new Set<string>();
    for (const r of data) {
      const raw = String(r.dataAplicacao ?? "").trim();
      if (raw.length >= 7 && /^\d{4}-\d{2}/.test(raw)) fromData.add(raw.slice(0, 7));
    }
    return [...fromData].sort(sortAsc);
  }, [availableMonths, data]);

  useEffect(() => {
    if (monthsMetaLoading || registeredMonths.length === 0 || didFixDefaultMonthRef.current) return;
    didFixDefaultMonthRef.current = true;
    setSelectedMonths((prev) => {
      if (prev.length !== 1 || prev[0] !== defaultMonth) return prev;
      if (registeredMonths.includes(defaultMonth)) return prev;
      return [...registeredMonths];
    });
  }, [registeredMonths, monthsMetaLoading, defaultMonth]);

  useEffect(() => {
    if (selectedMonths.length === 0) {
      setData([]);
      return;
    }
    if (apiData == null) {
      if (!isPlaceholderData) setData([]);
      return;
    }
    if (isPlaceholderData) return;
    const del = deletedIdsRef.current;
    setData(
      mergeTestSancoesIntoRows(
        apiData
          .map((r, i) => normalizeSancaoRowFromApi(r, i))
          .filter((r) => !del.has(String(r.id))),
      ),
    );
  }, [apiData, selectedMonths, isPlaceholderData]);

  const requestEditRow = useCallback((id: SancaoDisciplinarRow["id"]) => {
    if (!canEdit) return;
    const target = dataRef.current.find((row) => row.id === id) ?? null;
    if (!target) return;
    setEditInitialRow({ ...target });
    setLancarOpen(true);
  }, [canEdit]);

  const requestRemoveRow = useCallback((id: SancaoDisciplinarRow["id"]) => {
    if (!canEdit) return;
    const target = dataRef.current.find((row) => row.id === id) ?? null;
    if (target) setDeleteTarget(target);
  }, [canEdit]);

  const persistFullReplace = useCallback(
    async (rows: SancaoDisciplinarRow[], successTitle: string, successDescription: string) => {
      const trimmed = stripEmptyRows(rows);
      const invalid = trimmed.filter((r) => !r.dataAplicacao || !String(r.dataAplicacao).trim());
      if (invalid.length > 0) {
        toast({
          title: "Datas obrigatórias",
          description: `${invalid.length} linha(s) sem data de aplicação válida.`,
          variant: "destructive",
        });
        return false;
      }
      const semMotivo = trimmed.filter(rowFailsSancaoMotivoRule);
      if (semMotivo.length > 0) {
        toast({
          title: "Motivo obrigatório",
          description: `${semMotivo.length} linha(s) importada(s) sem motivo (coluna MOTIVO).`,
          variant: "destructive",
        });
        return false;
      }
      try {
        return await runWithSaving(async () => {
          await replaceSancoesDisciplinares(trimmed.map(rowToReplacePayload));
          deletedIdsRef.current.clear();
          void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
          void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares-months-meta"] });
          notifyDashboardSancoesUpdated();
          toast({ title: successTitle, description: successDescription });
          return true;
        }, "Salvando sanções…");
      } catch (err) {
        toast({
          title: "Erro ao gravar",
          description: err instanceof Error ? err.message : "Não foi possível gravar no banco.",
          variant: "destructive",
        });
        return false;
      }
    },
    [queryClient, toast, runWithSaving],
  );

  const confirmRemoveRow = useCallback(async () => {
    const target = deleteTarget;
    if (!target) return;

    setDeleteTarget(null);
    const prevSnapshot = dataRef.current;
    const prevDeletedIds = new Set(deletedIdsRef.current);
    const next = prevSnapshot.filter((row) => row.id !== target.id);
    setData(next);

    const key = String(target.id);
    const nextDeletedIds = new Set(prevDeletedIds);
    if (!key.startsWith("temp-") && !key.startsWith("import-")) {
      nextDeletedIds.add(key);
    }
    deletedIdsRef.current = nextDeletedIds;

    if (!isApiConfigured()) {
      toast({ title: "Registro excluído", description: "Linha removida da listagem." });
      return;
    }

    try {
      await runWithSaving(async () => {
        const full = await fetchServerRowsForMerge();
        const mergedRows = mergeSancoeRowsForSave(full, next, nextDeletedIds);
        const invalidMerged = mergedRows.filter(rowInvalidForSancaoReplace);
        if (invalidMerged.length > 0) {
          throw new Error("Há linhas sem data válida ou lançamentos provisórios sem motivo.");
        }
        await replaceSancoesDisciplinares(mergedRows.map(rowToReplacePayload), { allowEmpty: mergedRows.length === 0 });
        deletedIdsRef.current.clear();
        void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
        void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares-months-meta"] });
        notifyDashboardSancoesUpdated();
        toast({ title: "Registro excluído", description: "Sanção removida do banco." });
      }, "Excluindo sanção…");
    } catch (err) {
      deletedIdsRef.current = prevDeletedIds;
      setData(prevSnapshot);
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Não foi possível excluir a linha.",
        variant: "destructive",
      });
    }
  }, [deleteTarget, fetchServerRowsForMerge, queryClient, toast, runWithSaving]);

  const handleLancar = useCallback(
    async (row: SancaoDisciplinarRow) => {
      const prevSnapshot = dataRef.current;
      const idStr = String(row.id);
      const isNewTemp = idStr.startsWith("temp-");
      const next = isNewTemp
        ? [...prevSnapshot, row]
        : prevSnapshot.map((r) => (String(r.id) === idStr ? row : r));
      setData(next);
      const ym = String(row.dataAplicacao).trim().slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        setSelectedMonths((p) => (p.includes(ym) ? p : [...p, ym].sort(sortYmAsc)));
      }
      if (isLaunchDocTestMode()) {
        upsertTestSancaoRow(row);
        toast({
          title: isNewTemp ? "Sanção salva (modo teste)" : "Sanção atualizada (modo teste)",
          description: "Registro mantido localmente. Não foi enviado ao banco de produção.",
        });
        return;
      }
      if (!isApiConfigured()) {
        toast({ title: "Sanção lançada", description: "Registro incluído na listagem." });
        return;
      }
      try {
        await runWithSaving(async () => {
          const full = await fetchServerRowsForMerge();
          const mergedRows = mergeSancoeRowsForSave(full, next, deletedIdsRef.current);
          const invalidMerged = mergedRows.filter(rowInvalidForSancaoReplace);
          if (invalidMerged.length > 0) {
            throw new Error("Há linhas sem data válida ou lançamentos provisórios sem motivo.");
          }
          await replaceSancoesDisciplinares(mergedRows.map(rowToReplacePayload), { allowEmpty: mergedRows.length === 0 });
          deletedIdsRef.current.clear();
          void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
          void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares-months-meta"] });
          void queryClient.invalidateQueries({ queryKey: ["sancao-launch-documents"] });
          notifyDashboardSancoesUpdated();
          toast({
            title: isNewTemp ? "Sanção salva" : "Sanção atualizada",
            description: isNewTemp ? "Registro gravado no banco." : "Alterações gravadas no banco.",
          });
        }, isNewTemp ? "Salvando sanção…" : "Atualizando sanção…");
      } catch (err) {
        setData(prevSnapshot);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          const hadYmBefore = prevSnapshot.some((r) => String(r.dataAplicacao ?? "").trim().slice(0, 7) === ym);
          if (!hadYmBefore) {
            setSelectedMonths((p) => p.filter((x) => x !== ym));
          }
        }
        toast({
          title: "Erro ao gravar",
          description: err instanceof Error ? err.message : "Não foi possível gravar no banco.",
          variant: "destructive",
        });
        throw err;
      }
    },
    [fetchServerRowsForMerge, queryClient, toast, runWithSaving],
  );

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
        toast({ title: "Arquivo inválido", description: "Selecione um arquivo Excel (.xlsx ou .xls).", variant: "destructive" });
        e.target.value = "";
        return;
      }
      parseFile(file)
        .then(async (parsed) => {
          if (parsed.length === 0) {
            toast({
              title: "Planilha vazia",
              description: "Nenhuma linha com data de aplicação na aba do modelo.",
              variant: "destructive",
            });
            return;
          }
          const withIds: SancaoDisciplinarRow[] = parsed.map((row, i) => ({
            id: `import-${Date.now()}-${i}`,
            ...row,
          }));
          setData(withIds);
          deletedIdsRef.current.clear();
          const yms = [...new Set(parsed.map((r) => r.dataAplicacao?.slice(0, 7)).filter(Boolean) as string[])].sort((a, b) =>
            a.localeCompare(b, "en-CA"),
          );
          if (yms.length > 0) setSelectedMonths(yms);
          if (isApiConfigured()) {
            await persistFullReplace(withIds, "Importação concluída", `${parsed.length} registro(s) importados e salvos.`);
          } else {
            toast({
              title: "Importação local",
              description: `${parsed.length} linha(s) carregadas. Configure a API para gravar no banco.`,
            });
          }
        })
        .catch(() => {
          toast({ title: "Erro na importação", description: "Não foi possível ler o arquivo.", variant: "destructive" });
        });
      e.target.value = "";
    },
    [parseFile, persistFullReplace, toast],
  );

  const applyClientFilters = useCallback(
    (rows: SancaoDisciplinarRow[]) =>
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
          if (!rowMatchesSancaoColumnFilter(row, col.key, deferredColFilters[col.key])) return false;
        }
        return true;
      }),
    [deferredSearch, deferredColFilters, visibleColumns],
  );

  const monthFiltered = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const set = new Set(selectedMonths.map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}$/.test(x)));
    if (set.size === 0) return [];
    return data.filter((row) => {
      const raw = String(row.dataAplicacao ?? "").trim();
      if (raw.length < 7) return false;
      return set.has(raw.slice(0, 7));
    });
  }, [data, selectedMonths]);

  const attachmentResolveItems = useMemo(
    () => buildSancaoAttachmentResolveItems(monthFiltered, documentCategoryOptions),
    [monthFiltered, documentCategoryOptions],
  );

  const attachmentResolveKey = useMemo(
    () => attachmentResolveItems.map((item) => item.sourceRecordId).sort().join("|"),
    [attachmentResolveItems],
  );

  const { data: serverAttachmentLinks } = useQuery({
    queryKey: ["sancao-launch-documents", attachmentResolveKey],
    queryFn: () => resolveLaunchDocuments({ items: attachmentResolveItems }),
    enabled:
      launchAttachmentsEnabled &&
      isApiConfigured() &&
      !isLaunchDocTestMode() &&
      attachmentResolveItems.length > 0,
    staleTime: 30_000,
  });

  const mergedSancaoAttachments = useMemo(() => {
    if (!launchAttachmentsEnabled) return undefined;
    return mergeAusenciaAttachmentIndex(sancaoAttachments, serverAttachmentLinks?.links ?? []);
  }, [launchAttachmentsEnabled, sancaoAttachments, serverAttachmentLinks]);

  const filtered = useMemo(() => {
    let rows = applyClientFilters(monthFiltered);
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
  }, [monthFiltered, applyClientFilters, sortConfig]);

  const handleReconcileAutosFromAusencias = useCallback(async () => {
    if (!canEdit || !isApiConfigured()) return;
    setReconcileBusy(true);
    try {
      await runWithSaving(async () => {
        const resultado = await syncSuspensaoAusenciasParaSancoesPadrao(tiposSancaoOptions);
        if (!resultado.ok) {
          throw new Error(resultado.message ?? "Falha ao alinhar com ausências.");
        }
        deletedIdsRef.current.clear();
        void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
        void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares-months-meta"] });
        notifyDashboardSancoesUpdated();
        toast({
          title: "Registros ajustados",
          description:
            "Sanções automáticas derivadas das ausências foram reconstruídas no servidor — duplicações típicas de fluxo antigo foram removidas; lançamentos manuais mantidos.",
        });
        setReconcileAutosOpen(false);
      }, "Sincronizando sanções…");
    } catch (err) {
      toast({
        title: "Não foi possível concluir",
        description: err instanceof Error ? err.message : "Tente novamente ou verifique a API.",
        variant: "destructive",
      });
    } finally {
      setReconcileBusy(false);
    }
  }, [canEdit, tiposSancaoOptions, queryClient, toast, runWithSaving]);

  const handleExport = useCallback(async () => {
    const exportRows = stripEmptyRows(filtered).filter((r) => r.dataAplicacao && String(r.dataAplicacao).trim());
    if (exportRows.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Ajuste filtros ou inclua linhas com data de aplicação.",
        variant: "destructive",
      });
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportToExcel(exportRows, `sancoes-disciplinares_${stamp}.xlsx`);
      toast({
        title: "Exportação concluída",
        description: `${exportRows.length} linha(s) (visíveis com filtros).`,
      });
    } catch {
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    }
  }, [filtered, exportToExcel, toast]);

  const onColumnFilterApply = useCallback((key: keyof SancaoDisciplinarRow, filter: SancaoColumnFilter) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter.kind === "all") delete next[key];
      else next[key] = filter;
      return next;
    });
  }, []);

  const handleHiddenColumnsChange = useCallback(
    (next: string[]) => {
      const normalized = next.filter(
        (key): key is keyof SancaoDisciplinarRow => ALL_COLUMNS.some((column) => column.key === key),
      );
      setHiddenColumns(normalized);
      setColumnFilters((prev) => {
        const updated = { ...prev };
        for (const key of normalized) {
          delete updated[key];
        }
        return updated;
      });
      setSortConfig((prev) => (prev && normalized.includes(prev.key) ? null : prev));
    },
    [],
  );

  const toggleMonth = (ym: string) => {
    setSelectedMonths((prev) => {
      const has = prev.includes(ym);
      if (has) return prev.filter((x) => x !== ym);
      return [...prev, ym].sort(sortYmAsc);
    });
  };

  const selectAllRegisteredMonths = useCallback(() => {
    setSelectedMonths([...registeredMonths]);
  }, [registeredMonths]);

  const deselectAllMonths = useCallback(() => {
    setSelectedMonths([]);
  }, []);

  const monthSummary = useMemo(() => {
    if (selectedMonths.length === 0) return "Nenhum mês selecionado";
    if (selectedMonths.length === 1) return labelMes(selectedMonths[0]);
    const asc = [...selectedMonths].sort((a, b) => a.localeCompare(b));
    if (selectedMonths.length === 2) {
      return `${labelMes(asc[0])} · ${labelMes(asc[1])}`;
    }
    return `${selectedMonths.length} meses`;
  }, [selectedMonths]);

  const showInitialLoad = selectedMonths.length > 0 && isLoading && apiData == null && !isPlaceholderData;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <LancarSancaoDialog
        canEdit={canEdit}
        open={lancarOpen}
        onOpenChange={(open) => {
          setLancarOpen(open);
          if (!open) setEditInitialRow(null);
        }}
        onSave={handleLancar}
        organicoRows={organicoRows}
        tiposSancaoOptions={tiposSancaoOptions}
        initialRow={editInitialRow}
        documentCategoryOptions={documentCategoryOptions}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={monthPopoverOpen} onOpenChange={setMonthPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 max-w-[min(100%,20rem)]">
                <CalendarRange className="w-4 h-4 shrink-0" />
                <span className="truncate">{monthSummary}</span>
                {selectedMonths.length > 0 ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal shrink-0">
                    {selectedMonths.length}
                  </Badge>
                ) : null}
                <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(calc(100vw-2rem),20rem)] p-0" align="start">
              <div className="flex flex-wrap gap-1.5 p-2 border-b border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={registeredMonths.length === 0}
                  onClick={selectAllRegisteredMonths}
                >
                  Selecionar todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selectedMonths.length === 0}
                  onClick={deselectAllMonths}
                >
                  Desmarcar todos
                </Button>
              </div>
              <ScrollArea className="h-[min(60vh,20rem)]">
                <div className="p-2 space-y-1 pr-3">
                  {monthsMetaLoading && <p className="text-xs text-muted-foreground px-1 py-2">Carregando…</p>}
                  {!monthsMetaLoading && registeredMonths.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-2">Nenhum mês com dados registrado.</p>
                  )}
                  {registeredMonths.map((ym) => (
                    <label
                      key={ym}
                      className={cn(
                        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/80",
                        selectedMonths.includes(ym) && "bg-muted",
                      )}
                    >
                      <Checkbox checked={selectedMonths.includes(ym)} onCheckedChange={() => toggleMonth(ym)} />
                      <span className="capitalize truncate min-w-0">{labelMes(ym)}</span>
                      <span className="text-muted-foreground text-xs ml-auto font-mono shrink-0">{ym}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <ColumnVisibilityPopover
            columns={ALL_COLUMNS}
            hiddenKeys={hiddenColumns}
            onHiddenKeysChange={handleHiddenColumnsChange}
            title="Colunas da tabela de sanções"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <Upload className="w-4 h-4 mr-1" /> Importar Excel
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel/visível
          </Button>
          {canEdit && isApiConfigured() ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={reconcileBusy || tiposSancaoOptions.length === 0}
              onClick={() => setReconcileAutosOpen(true)}
              title="Remove duplicatas típicas das automáticas e alinha com ausências de suspensão"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1", reconcileBusy && "animate-spin")} />
              Corrigir automáticas
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditInitialRow(null);
                setLancarOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Lançar sanção
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Nome ou ID (matrícula)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Erro ao carregar sanções. Tente novamente ou verifique a API.
        </div>
      ) : null}

      {showInitialLoad ? (
        <div className="flex items-center justify-center min-h-[28vh] rounded-md border border-dashed border-border">
          <p className="text-muted-foreground text-sm">Carregando sanções…</p>
        </div>
      ) : (
        <SancoesDisciplinaresVirtualGrid
          columns={visibleColumns}
          sourceRows={monthFiltered}
          rows={filtered}
          canEdit={canEdit}
          onEditRow={requestEditRow}
          onRemoveRow={requestRemoveRow}
          columnFilters={columnFilters}
          onColumnFilterApply={onColumnFilterApply}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          sancaoAttachments={mergedSancaoAttachments}
        />
      )}

      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span>
          {filtered.length} visíveis · {monthFiltered.length} no período · {data.length} carregados · {selectedMonths.length}{" "}
          {selectedMonths.length === 1 ? "mês selecionado" : "meses selecionados"}
          {registeredMonths.length > 0 ? ` (${registeredMonths.length} com dados no sistema)` : ""}
        </span>
        {isFetching ? <span className="text-sky-700 dark:text-sky-400">Atualizando dados do período…</span> : null}
        {deferredSearch !== search || deferredColFilters !== columnFilters ? (
          <span className="text-amber-700 dark:text-amber-500">Atualizando filtros…</span>
        ) : null}
        {!isApiConfigured() ? <span>API não configurada: dados locais / mock</span> : null}
      </div>

      <AlertDialog
        open={reconcileAutosOpen}
        onOpenChange={(open) => {
          if (!open && reconcileBusy) return;
          setReconcileAutosOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Corrigir sanções automáticas no banco?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Será feita uma <strong className="text-foreground">reconstrução completa</strong> das linhas que o sistema gera a
                  partir das <strong className="text-foreground">ausências de suspensão</strong> em Faltas e atestados. Isto remove
                  no servidor as duplicações “órfãs” deixadas pela regra antiga e deixa, no máximo, <strong>uma</strong> linha
                  automática por falta correspondente.
                </p>
                <p>
                  <strong className="text-foreground">Lançamentos manuais</strong> na aba Sanções (sem vínculo com essa lógica)
                  são mantidos.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reconcileBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reconcileBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleReconcileAutosFromAusencias();
              }}
            >
              {reconcileBusy ? "A processar…" : "Corrigir agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sanção?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  Excluir o registro de <strong>{deleteTarget.nomeFuncionario || "colaborador sem nome"}</strong> com data{" "}
                  <strong>{deleteTarget.dataAplicacao || "—"}</strong>? A linha será removida da tela e do banco.
                </>
              ) : (
                "Confirme a exclusão deste registro."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemoveRow}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
