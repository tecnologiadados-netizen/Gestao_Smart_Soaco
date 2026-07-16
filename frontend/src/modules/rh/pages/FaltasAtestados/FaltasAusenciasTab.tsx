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
import { Plus, Search, Upload, Download, CalendarRange, ChevronDown, Trash2 } from "lucide-react";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import {
  getFaltasAtestados,
  getFaltasAtestadosMonthList,
  getFaltasCadastros,
  getOrganico,
  getSecullumFuncionarios,
  getSancoesDisciplinares,
  replaceFaltasAtestados,
  isApiConfigured,
} from "@rh/lib/api-client";
import { removerAlertasPorFaltaIds } from "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage";
import type { FaltaRow, FaltaReplaceRow, FaltaCadastrosData } from "@rh/types/api";
import { useFaltasAtestadosExcel } from "@rh/pages/FaltasAtestados/useFaltasAtestadosExcel";
import { FaltaAusenciasVirtualGrid } from "@rh/pages/FaltasAtestados/FaltasAusenciasVirtualGrid";
import { LancarAusenciaDialog } from "@rh/pages/FaltasAtestados/LancarAusenciaDialog";
import { buildAusenciaAttachmentIndex, buildAusenciaAttachmentResolveItems, mergeAusenciaAttachmentIndex } from "@rh/lib/launch-document-access";
import { isLaunchDocAttachmentEnabled, isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import { ausenciaExigeAnexoDocumento, ausenciaPermiteAnexoOpcionalDocumento } from "@rh/lib/launch-document-rules";
import { LAUNCH_DOC_LINKS_CHANGED_EVENT } from "@rh/lib/launch-document-links";
import { LAUNCH_DOC_QUEUE_CHANGED_EVENT } from "@rh/lib/launch-document-queue";
import { resolveLaunchDocuments } from "@rh/lib/organico-documents-api";
import { ColumnVisibilityPopover } from "@rh/pages/FaltasAtestados/ColumnVisibilityPopover";
import {
  type FaltaColumnFilter,
  rowMatchesColumnFilter,
} from "@rh/pages/FaltasAtestados/faltas-column-filter";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import {
  readFaltasAusenciasFilters,
  writeFaltasAusenciasFilters,
} from "@rh/pages/FaltasAtestados/faltas-ui-filters-persistence";
import { mergeTestFaltasIntoRows, upsertTestFaltaRow } from "@rh/lib/launch-document-test-records";
import { resolveDocumentCategoryOptions } from "@rh/lib/organico-documents";
import {
  ALL_COLUMNS,
  HIDDEN_COLUMNS_LS_KEY,
  loadHiddenColumns,
} from "@rh/pages/FaltasAtestados/faltas-ausencias-columns";
import { syncSuspensaoAusenciasParaSancoesPadrao } from "@rh/pages/FaltasAtestados/sync-suspensao-ausencia-to-sancoes";
import { reconcileVisibleRowIntoMap } from "@rh/pages/FaltasAtestados/faltas-save-merge";
import { cn } from "@rh/lib/utils";

const DASHBOARD_AUSENCIAS_UPDATED_EVENT = "rh-dashboard-ausencias-updated";
const DASHBOARD_SANCOES_UPDATED_EVENT = "rh-dashboard-sancoes-updated";

function notifyDashboardAusenciasUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_AUSENCIAS_UPDATED_EVENT));
}

function notifyDashboardSancoesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_SANCOES_UPDATED_EVENT));
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

function rowToReplacePayload(row: FaltaRow): FaltaReplaceRow {
  const { id, ...rest } = row;
  const idStr = String(id);
  if (idStr.startsWith("import-")) return rest;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)) {
    return { ...rest, id: idStr };
  }
  return rest;
}

function stripEmptyRows(rows: FaltaRow[]): FaltaRow[] {
  return rows.filter((r) => {
    const hasDate = Boolean(r.data && String(r.data).trim());
    const hasOther =
      r.mesFalta.trim() ||
      r.matricula.trim() ||
      r.nomeFuncionario.trim() ||
      r.endereco.trim() ||
      r.area.trim() ||
      r.setor.trim() ||
      r.lider.trim() ||
      r.periodo.trim() ||
      r.qntd.trim() ||
      r.diasTurno.trim() ||
      r.tipo.trim() ||
      r.cid.trim() ||
      r.localAtendimento.trim() ||
      r.medicoResponsavel.trim() ||
      r.observacoes.trim() ||
      r.aprovado.trim() ||
      r.reprovado.trim();
    return hasDate || hasOther;
  });
}

function uniqueSuggestions(values: string[], max = 500): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (t) s.add(t);
    if (s.size >= max) break;
  }
  return [...s];
}

/**
 * Mescla snapshot completo do servidor com a grade atual.
 * `fullServer` precisa incluir **todos** os registros do banco (não usar fetch “exceto meses” aqui):
 * senão IDs das linhas dos meses em edição não entram em `serverIds` e são descartadas — o replace
 * trunca a tabela e regravaria só parte dos dados (perda em massa).
 */
function mergeFaltasForSave(
  fullServer: FaltaRow[],
  visibleRows: FaltaRow[],
  deletedIds: Set<string>,
): FaltaReplaceRow[] {
  const map = new Map<string, FaltaRow>();
  for (const r of fullServer) {
    map.set(String(r.id), { ...r, id: r.id });
  }
  const serverIds = new Set(map.keys());
  for (const id of deletedIds) {
    map.delete(id);
  }
  for (const row of stripEmptyRows(visibleRows)) {
    reconcileVisibleRowIntoMap(map, row, serverIds);
  }
  return [...map.values()].map(rowToReplacePayload);
}

export default function FaltasAusenciasTab({
  canEdit = true,
  onNavigateToRegrasAlertas,
}: {
  canEdit?: boolean;
  onNavigateToRegrasAlertas?: () => void;
}) {
  const queryClient = useQueryClient();
  const { runWithSaving } = useSavingOverlay();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const { parseFile, exportToExcel } = useFaltasAtestadosExcel();
  const savedFilters = readFaltasAusenciasFilters();
  const launchAttachmentsEnabled = isLaunchDocAttachmentEnabled();
  const [ausenciaAttachments, setAusenciaAttachments] = useState(() => buildAusenciaAttachmentIndex());

  useEffect(() => {
    if (!launchAttachmentsEnabled) return;
    const refresh = () => setAusenciaAttachments(buildAusenciaAttachmentIndex());
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
    queryKey: ["faltas-atestados-months-meta"],
    queryFn: getFaltasAtestadosMonthList,
  });

  const { data: apiData, isLoading, isError, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["faltas-atestados", monthsQueryKey],
    queryFn: () => getFaltasAtestados([...selectedMonths].sort()),
    enabled: selectedMonths.length > 0,
    placeholderData: keepPreviousData,
  });

  const { data: cadastroData } = useQuery({
    queryKey: ["faltas-cadastros"],
    queryFn: getFaltasCadastros,
  });

  const sortCadValor = (a: { valor: string }, b: { valor: string }) =>
    a.valor.localeCompare(b.valor, "pt-BR", { sensitivity: "base" });

  const cadastroBundle: FaltaCadastrosData = useMemo(
    () =>
      cadastroData ?? {
        periodos: [],
        tipos: [],
        cids: [],
        tiposSancoes: [],
        categoriasDocumentos: [],
      },
    [cadastroData],
  );

  const cadastroTiposSancoesValores = useMemo(
    () => [...cadastroBundle.tiposSancoes].sort(sortCadValor).map((item) => String(item.valor ?? "").trim()).filter(Boolean),
    [cadastroBundle.tiposSancoes],
  );

  const documentCategoryOptions = useMemo(
    () => resolveDocumentCategoryOptions(cadastroBundle.categoriasDocumentos),
    [cadastroBundle.categoriasDocumentos],
  );

  const [data, setData] = useState<FaltaRow[]>([]);
  const [search, setSearch] = useState(() => savedFilters.search ?? "");
  const deferredSearch = useDeferredValue(search);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof FaltaRow, FaltaColumnFilter>>>(
    () => savedFilters.columnFilters ?? {},
  );
  const [hiddenColumns, setHiddenColumns] = useState<Array<keyof FaltaRow>>(() => loadHiddenColumns());
  const deferredColFilters = useDeferredValue(columnFilters);
  const [monthPopoverOpen, setMonthPopoverOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof FaltaRow; dir: "asc" | "desc" } | null>(
    () => savedFilters.sortConfig ?? null,
  );
  const [lancarAusenciaOpen, setLancarAusenciaOpen] = useState(false);
  const [editInitialRow, setEditInitialRow] = useState<FaltaRow | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const dataRef = useRef<FaltaRow[]>([]);
  const saveInFlightRef = useRef(false);
  const { toast } = useToast();
  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns],
  );

  const { data: organicoRows = [] } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
    staleTime: 60_000,
    enabled: lancarAusenciaOpen,
  });

  const { data: secullumFuncionarios = [] } = useQuery({
    queryKey: ["secullum-funcionarios"],
    queryFn: getSecullumFuncionarios,
    staleTime: 60_000,
    enabled: lancarAusenciaOpen && isApiConfigured(),
  });

  /** Lista completa para avisar duplicidade quando a ausência também propagaria para Sanções. */
  const { data: todasSancoesDisciplinares = [], isFetching: todasSancoesDisciplinaresLoading } = useQuery({
    queryKey: ["sancoes-disciplinares", "todas-checar-dup-lancamento-ausencia"],
    queryFn: () => getSancoesDisciplinares(),
    staleTime: 30_000,
    enabled: lancarAusenciaOpen,
  });

  const enderecoByMatricula = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of secullumFuncionarios) {
      if (f.numeroFolha && f.endereco) {
        map[String(f.numeroFolha).trim()] = f.endereco;
      }
    }
    return map;
  }, [secullumFuncionarios]);

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
    writeFaltasAusenciasFilters({
      search,
      columnFilters,
      selectedMonths,
      sortConfig,
    });
  }, [search, columnFilters, selectedMonths, sortConfig]);

  /** Sempre lista completa do servidor: necessário para o merge ser correto antes do replace (truncate + insert). */
  const fetchServerRowsForMerge = useCallback(async (): Promise<FaltaRow[]> => getFaltasAtestados(), []);

  /**
   * Meses com registros (YYYY-MM), ordem crescente (mais antigo primeiro).
   * Se a meta da API vier vazia, deriva das linhas já carregadas.
   */
  const registeredMonths = useMemo(() => {
    const sortAsc = (a: string, b: string) => a.localeCompare(b, "en-CA");
    const api = [...availableMonths].sort(sortAsc);
    if (api.length > 0) return api;
    const fromData = new Set<string>();
    for (const r of data) {
      const raw = String(r.data ?? "").trim();
      if (raw.length >= 7 && /^\d{4}-\d{2}/.test(raw)) fromData.add(raw.slice(0, 7));
    }
    return [...fromData].sort(sortAsc);
  }, [availableMonths, data]);

  /** Se o mês “padrão” (calendário) não tem dados, carrega todos os meses registrados de uma vez. */
  useEffect(() => {
    if (monthsMetaLoading || registeredMonths.length === 0 || didFixDefaultMonthRef.current) return;
    didFixDefaultMonthRef.current = true;
    setSelectedMonths((prev) => {
      if (prev.length !== 1 || prev[0] !== defaultMonth) return prev;
      if (registeredMonths.includes(defaultMonth)) return prev;
      return [...registeredMonths];
    });
  }, [registeredMonths, monthsMetaLoading, defaultMonth]);

  const dlPeriodos = useMemo(
    () =>
      uniqueSuggestions(
        [...cadastroBundle.periodos].sort(sortCadValor).map((p) => p.valor),
      ),
    [cadastroBundle.periodos],
  );
  const dlTipos = useMemo(
    () =>
      uniqueSuggestions(
        [...cadastroBundle.tipos].sort(sortCadValor).map((p) => p.valor),
      ),
    [cadastroBundle.tipos],
  );
  const dlCids = useMemo(
    () =>
      uniqueSuggestions(
        [...cadastroBundle.cids].sort(sortCadValor).map((p) => p.valor),
        400,
      ),
    [cadastroBundle.cids],
  );

  useEffect(() => {
    if (selectedMonths.length === 0) {
      setData([]);
      return;
    }
    if (apiData == null) {
      if (!isPlaceholderData) setData([]);
      return;
    }
    // Com keepPreviousData, `apiData` pode ser do período anterior até o fetch terminar;
    // não gravar isso em `data` (monthFiltered já esconde linhas fora dos meses atuais).
    if (isPlaceholderData) return;
    const del = deletedIdsRef.current;
    setData(
      mergeTestFaltasIntoRows(
        apiData
          .map((r, i) => ({
            ...r,
            id: typeof r.id === "string" && r.id.length > 0 ? r.id : i + 1,
          }))
          .filter((r) => !del.has(String(r.id))),
      ),
    );
  }, [apiData, selectedMonths, isPlaceholderData]);

  const requestEditRow = useCallback((id: FaltaRow["id"]) => {
    if (!canEdit) return;
    const target = dataRef.current.find((row) => row.id === id) ?? null;
    if (!target) return;
    setEditInitialRow({ ...target });
    setLancarAusenciaOpen(true);
  }, [canEdit]);

  const toggleRowSelection = useCallback((id: FaltaRow["id"]) => {
    if (!canEdit || deleteProcessing) return;
    const key = String(id);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [canEdit, deleteProcessing]);

  const aplicarSuspensaoComoSancoesAposAusenciasGravadas = useCallback(async () => {
    if (!isApiConfigured()) return true;
    const resultado = await syncSuspensaoAusenciasParaSancoesPadrao(cadastroTiposSancoesValores);
    if (!resultado.ok) {
      toast({
        title: "Ausência salva; sanções não sincronizadas",
        description: resultado.message ?? "Salve novamente ou ajuste pela aba Sanções disciplinares.",
        variant: "destructive",
      });
      return false;
    }
    void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
    void queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares-months-meta"] });
    notifyDashboardSancoesUpdated();
    return true;
  }, [cadastroTiposSancoesValores, queryClient, toast]);

  const persistFullReplace = useCallback(
    async (rows: FaltaRow[], successTitle: string, successDescription: string) => {
      const trimmed = stripEmptyRows(rows);
      const invalid = trimmed.filter((r) => !r.data || !String(r.data).trim());
      if (invalid.length > 0) {
        toast({
          title: "Datas obrigatórias",
          description: `${invalid.length} linha(s) sem data válida.`,
          variant: "destructive",
        });
        return false;
      }
      try {
        return await runWithSaving(async () => {
          await replaceFaltasAtestados(trimmed.map(rowToReplacePayload));
          deletedIdsRef.current.clear();
          void queryClient.invalidateQueries({ queryKey: ["faltas-atestados"] });
          void queryClient.invalidateQueries({ queryKey: ["faltas-atestados-months-meta"] });
          notifyDashboardAusenciasUpdated();
          toast({ title: successTitle, description: successDescription });
          void aplicarSuspensaoComoSancoesAposAusenciasGravadas();
          return true;
        }, "Salvando ausências…");
      } catch (err) {
        toast({
          title: "Erro ao gravar",
          description: err instanceof Error ? err.message : "Não foi possível gravar no banco.",
          variant: "destructive",
        });
        return false;
      }
    },
    [queryClient, toast, aplicarSuspensaoComoSancoesAposAusenciasGravadas, runWithSaving],
  );

  const deleteRowsInBatch = useCallback(async (ids: Set<string>) => {
    if (ids.size === 0) return;
    const prevSnapshot = dataRef.current;
    const prevDeletedIds = new Set(deletedIdsRef.current);
    const next = prevSnapshot.filter((row) => !ids.has(String(row.id)));
    setData(next);
    setSelectedRowIds((prev) => {
      const updated = new Set(prev);
      for (const id of ids) updated.delete(id);
      return updated;
    });

    const nextDeletedIds = new Set(prevDeletedIds);
    for (const id of ids) {
      if (!id.startsWith("temp-") && !id.startsWith("import-")) {
        nextDeletedIds.add(id);
      }
    }
    deletedIdsRef.current = nextDeletedIds;

    if (!isApiConfigured()) {
      await removerAlertasPorFaltaIds(ids);
      void queryClient.invalidateQueries({ queryKey: ["faltas-ausencia-inconsistencias"] });
      void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-enquadramentos"] });
      toast({
        title: ids.size === 1 ? "Ausência excluída" : "Ausências excluídas",
        description: `${ids.size} linha(s) removida(s) da listagem.`,
      });
      return;
    }

    try {
      await runWithSaving(async () => {
        const full = await getFaltasAtestados();
        const merged = mergeFaltasForSave(full, next, nextDeletedIds);
        const invalidMerged = merged.filter((r) => !r.data || !String(r.data).trim());
        if (invalidMerged.length > 0) {
          throw new Error("Há linhas inválidas após a exclusão.");
        }
        await replaceFaltasAtestados(merged, { allowEmpty: merged.length === 0 });
        deletedIdsRef.current.clear();
        await removerAlertasPorFaltaIds(ids);
        void queryClient.invalidateQueries({ queryKey: ["faltas-ausencia-inconsistencias"] });
        void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-enquadramentos"] });
        void queryClient.invalidateQueries({ queryKey: ["faltas-atestados"] });
        void queryClient.invalidateQueries({ queryKey: ["faltas-atestados-months-meta"] });
        notifyDashboardAusenciasUpdated();
        toast({
          title: ids.size === 1 ? "Ausência excluída" : "Ausências excluídas",
          description:
            ids.size === 1
              ? "Registro removido do sistema e do banco."
              : `${ids.size} registros removidos do sistema e do banco.`,
        });
        void aplicarSuspensaoComoSancoesAposAusenciasGravadas();
      }, ids.size === 1 ? "Excluindo ausência…" : "Excluindo ausências…");
    } catch (err) {
      deletedIdsRef.current = prevDeletedIds;
      setData(prevSnapshot);
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Não foi possível concluir a exclusão em lote.",
        variant: "destructive",
      });
    }
  }, [queryClient, toast, aplicarSuspensaoComoSancoesAposAusenciasGravadas, runWithSaving]);

  const confirmBulkRemove = useCallback(async () => {
    if (selectedRowIds.size === 0 || deleteProcessing) return;
    setBulkDeleteConfirmOpen(false);
    setDeleteProcessing(true);
    try {
      await deleteRowsInBatch(new Set(selectedRowIds));
    } finally {
      setDeleteProcessing(false);
    }
  }, [deleteProcessing, deleteRowsInBatch, selectedRowIds]);

  const handleLancarAusencia = useCallback(
    async (row: FaltaRow) => {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      const prevSnapshot = dataRef.current;
      const idStr = String(row.id);
      const isNew = !prevSnapshot.some((r) => String(r.id) === idStr);
      const next = isNew
        ? [...prevSnapshot, row]
        : prevSnapshot.map((r) => (String(r.id) === idStr ? row : r));
      setData(next);
      const ym = String(row.data).trim().slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        setSelectedMonths((p) => (p.includes(ym) ? p : [...p, ym].sort(sortYmAsc)));
      }
      try {
        if (isLaunchDocTestMode()) {
          upsertTestFaltaRow(row);
          toast({
            title: isNew ? "Ausência salva (modo teste)" : "Ausência atualizada (modo teste)",
            description: "Registro mantido localmente. Não foi enviado ao banco de produção.",
          });
          return;
        }
        if (!isApiConfigured()) {
          toast({ title: "Ausência lançada", description: "Registro incluído na listagem." });
          return;
        }
        await runWithSaving(async () => {
          const full = await fetchServerRowsForMerge();
          const merged = mergeFaltasForSave(full, next, deletedIdsRef.current);
          const invalidMerged = merged.filter((r) => !r.data || !String(r.data).trim());
          if (invalidMerged.length > 0) {
            throw new Error("Há linhas inválidas após o merge.");
          }
          await replaceFaltasAtestados(merged, { allowEmpty: merged.length === 0 });
          deletedIdsRef.current.clear();
          void queryClient.invalidateQueries({ queryKey: ["faltas-atestados"] });
          void queryClient.invalidateQueries({ queryKey: ["faltas-atestados-months-meta"] });
          void queryClient.invalidateQueries({ queryKey: ["ausencia-launch-documents"] });
          notifyDashboardAusenciasUpdated();
          const tipo = String(row.tipo ?? "").trim();
          const anexoTratadoNoDialog =
            launchAttachmentsEnabled
            && (ausenciaExigeAnexoDocumento(tipo) || ausenciaPermiteAnexoOpcionalDocumento(tipo));
          if (!anexoTratadoNoDialog) {
            toast({
              title: isNew ? "Ausência salva" : "Ausência atualizada",
              description: isNew ? "Registro gravado no banco." : "Alterações gravadas no banco.",
            });
          }
          void aplicarSuspensaoComoSancoesAposAusenciasGravadas();
        }, isNew ? "Salvando ausência…" : "Atualizando ausência…");
      } catch (err) {
        setData(prevSnapshot);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          const hadYmBefore = prevSnapshot.some((r) => String(r.data ?? "").trim().slice(0, 7) === ym);
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
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [fetchServerRowsForMerge, queryClient, toast, aplicarSuspensaoComoSancoesAposAusenciasGravadas, launchAttachmentsEnabled, runWithSaving],
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
            toast({ title: "Planilha vazia", description: "Nenhuma linha com DATA encontrada na aba principal.", variant: "destructive" });
            return;
          }
          const withIds: FaltaRow[] = parsed.map((row, i) => ({
            id: `import-${Date.now()}-${i}`,
            ...row,
          }));
          setData(withIds);
          deletedIdsRef.current.clear();
          const yms = [...new Set(parsed.map((r) => r.data?.slice(0, 7)).filter(Boolean) as string[])].sort((a, b) =>
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

  /** Reforça na grade o período escolhido (YYYY-MM em `data`). Sem meses selecionados = nada a exibir. */
  const monthFiltered = useMemo(() => {
    if (selectedMonths.length === 0) return [];
    const set = new Set(selectedMonths.map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}$/.test(x)));
    if (set.size === 0) return [];
    return data.filter((row) => {
      const raw = String(row.data ?? "").trim();
      if (raw.length < 7) return false;
      return set.has(raw.slice(0, 7));
    });
  }, [data, selectedMonths]);

  const attachmentResolveItems = useMemo(
    () => buildAusenciaAttachmentResolveItems(monthFiltered, documentCategoryOptions),
    [monthFiltered, documentCategoryOptions],
  );

  const attachmentResolveKey = useMemo(
    () => attachmentResolveItems.map((item) => item.sourceRecordId).sort().join("|"),
    [attachmentResolveItems],
  );

  const { data: serverAttachmentLinks } = useQuery({
    queryKey: ["ausencia-launch-documents", attachmentResolveKey],
    queryFn: () => resolveLaunchDocuments({ items: attachmentResolveItems }),
    enabled:
      launchAttachmentsEnabled &&
      isApiConfigured() &&
      !isLaunchDocTestMode() &&
      attachmentResolveItems.length > 0,
    staleTime: 30_000,
  });

  const mergedAusenciaAttachments = useMemo(() => {
    if (!launchAttachmentsEnabled) return undefined;
    return mergeAusenciaAttachmentIndex(ausenciaAttachments, serverAttachmentLinks?.links ?? []);
  }, [launchAttachmentsEnabled, ausenciaAttachments, serverAttachmentLinks]);

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

  useEffect(() => {
    const validIds = new Set(data.map((row) => String(row.id)));
    setSelectedRowIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [data]);

  const visibleRowIds = useMemo(() => filtered.map((row) => String(row.id)), [filtered]);
  const allVisibleSelected = useMemo(
    () => visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedRowIds.has(id)),
    [selectedRowIds, visibleRowIds],
  );
  const someVisibleSelected = useMemo(
    () => visibleRowIds.some((id) => selectedRowIds.has(id)) && !allVisibleSelected,
    [allVisibleSelected, selectedRowIds, visibleRowIds],
  );
  const selectedVisibleCount = useMemo(
    () => visibleRowIds.reduce((acc, id) => acc + (selectedRowIds.has(id) ? 1 : 0), 0),
    [selectedRowIds, visibleRowIds],
  );

  const toggleAllVisibleSelection = useCallback(() => {
    if (deleteProcessing) return;
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleRowIds) next.delete(id);
      } else {
        for (const id of visibleRowIds) next.add(id);
      }
      return next;
    });
  }, [allVisibleSelected, deleteProcessing, visibleRowIds]);

  const handleExport = useCallback(async () => {
    const exportRows = stripEmptyRows(filtered).filter((r) => r.data && String(r.data).trim());
    if (exportRows.length === 0) {
      toast({ title: "Nada para exportar", description: "Ajuste filtros ou inclua linhas com DATA.", variant: "destructive" });
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportToExcel(exportRows, cadastroBundle, `faltas-atestados_${stamp}.xlsx`);
      toast({
        title: "Exportação concluída",
        description: `${exportRows.length} linha(s) (visíveis com filtros).`,
      });
    } catch {
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    }
  }, [filtered, exportToExcel, cadastroBundle, toast]);

  const onColumnFilterApply = useCallback((key: keyof FaltaRow, filter: FaltaColumnFilter) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter.kind === "all") delete next[key];
      else next[key] = filter;
      return next;
    });
  }, []);

  const handleHiddenColumnsChange = useCallback(
    (next: string[]) => {
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
    },
    [],
  );

  const toggleMonth = (ym: string) => {
    setSelectedMonths((prev) => {
      const has = prev.includes(ym);
      if (has) {
        return prev.filter((x) => x !== ym);
      }
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

  const hasActiveFilters = useMemo(() => {
    const hasSearch = search.trim().length > 0;
    const hasColumnFilters = Object.keys(columnFilters).length > 0;
    const hasMonthFilter =
      registeredMonths.length > 0 &&
      (selectedMonths.length !== registeredMonths.length || selectedMonths.some((ym) => !registeredMonths.includes(ym)));
    return hasSearch || hasColumnFilters || hasMonthFilter;
  }, [search, columnFilters, registeredMonths, selectedMonths]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setColumnFilters({});
    if (registeredMonths.length > 0) {
      setSelectedMonths([...registeredMonths]);
    } else {
      setSelectedMonths(defaultMonth ? [defaultMonth] : []);
    }
  }, [registeredMonths, defaultMonth]);

  const showInitialAusenciasLoad =
    selectedMonths.length > 0 && isLoading && apiData == null && !isPlaceholderData;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <LancarAusenciaDialog
        canEdit={canEdit}
        open={lancarAusenciaOpen}
        onOpenChange={(open) => {
          setLancarAusenciaOpen(open);
          if (!open) setEditInitialRow(null);
        }}
        onSave={handleLancarAusencia}
        organicoRows={organicoRows}
        enderecoByMatricula={enderecoByMatricula}
        periodoOptions={dlPeriodos}
        tipoOptions={dlTipos}
        cidOptions={dlCids}
        tiposSancoesOpcoes={cadastroTiposSancoesValores}
        todasSancoesDisciplinares={todasSancoesDisciplinares}
        todasSancoesDisciplinaresLoading={todasSancoesDisciplinaresLoading}
        getAusenciasParaChecagemDuplicata={() => dataRef.current}
        initialRow={editInitialRow}
        documentCategoryOptions={documentCategoryOptions}
        onAlertasRegistrados={() => onNavigateToRegrasAlertas?.()}
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
              title="Colunas da tabela de ausências"
            />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedVisibleCount === 0 || deleteProcessing}
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir selecionadas ({selectedVisibleCount})
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <Upload className="w-4 h-4 mr-1" /> Importar Excel
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Exportar Excel/visível
          </Button>
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditInitialRow(null);
                setLancarAusenciaOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Lançar nova ausência
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Nome ou matrícula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {hasActiveFilters ? (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearAllFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

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

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Erro ao carregar ausências. Tente novamente ou verifique a API.
        </div>
      ) : null}

      {showInitialAusenciasLoad ? (
        <div className="flex items-center justify-center min-h-[28vh] rounded-md border border-dashed border-border">
          <p className="text-muted-foreground text-sm">Carregando ausências…</p>
        </div>
      ) : (
        <FaltaAusenciasVirtualGrid
          columns={visibleColumns}
          sourceRows={monthFiltered}
          rows={filtered}
          canEdit={canEdit}
          onEditRow={requestEditRow}
          columnFilters={columnFilters}
          onColumnFilterApply={onColumnFilterApply}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          selectedRowIds={selectedRowIds}
          onToggleRowSelection={toggleRowSelection}
          onToggleAllVisibleSelection={toggleAllVisibleSelection}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          disableSelection={deleteProcessing}
          ausenciaAttachments={mergedAusenciaAttachments}
        />
      )}

      <datalist id="faltas-dl-periodo">
        {dlPeriodos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="faltas-dl-tipo">
        {dlTipos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="faltas-dl-cid">
        {dlCids.map((p, i) => (
          <option key={`cid-${i}`} value={p} />
        ))}
      </datalist>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ausências selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedVisibleCount}</strong> linha(s) visível(is). A exclusão será enviada em
              lote para evitar perda de processamento quando várias linhas são removidas em sequência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmBulkRemove}
              disabled={deleteProcessing || selectedVisibleCount === 0}
            >
              Excluir em lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
