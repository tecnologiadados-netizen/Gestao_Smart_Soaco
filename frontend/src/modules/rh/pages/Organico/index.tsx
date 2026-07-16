import { useState, useCallback, useMemo, useEffect, useRef, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import AppLayout from "@rh/components/AppLayout";
import { cn } from "@rh/lib/utils";
import { textMatchesSearchQuery } from "@rh/lib/normalize-search-text";
import {
  buildOrganicoScopeKey,
  ORGANICO_SCOPE_DEFAULTS,
  readOrganicoFiltersStore,
  writeOrganicoFiltersStore,
  type OrganicoFilterScopeState,
  type OrganicoSoAcoSubTab,
} from "@rh/pages/Organico/organico-filters-persistence";
import { Button } from "@rh/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rh/components/ui/dropdown-menu";
import {
  Upload,
  Download,
  Search,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
  Maximize2,
  Square,
  LayoutGrid,
  Grid3x3,
  List,
  Table2,
} from "lucide-react";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import {
  addOrganicoAtividades,
  getOrganico,
  getOrganicoComentariosResumo,
  getOrganicoFotosResumo,
  replaceOrganico,
  getSecullumFuncionarios,
  isApiConfigured,
  lookupValueByMatriculaFolha,
  normalizeMatriculaFolha,
  secullumMatriculaSetMatchesOrganico,
  upsertOrganicoAlteracoesPendentes,
  getOrganicoAlteracoesPendentes,
  resolveOrganicoAlteracaoPendente,
  deleteOrganicoAlteracaoPendente,
  getRhSessionPermissions,
  getOrganicoRepresentantesAtivos,
  setOrganicoRepresentante,
  type OrganicoRepresentante,
} from "@rh/lib/api-client";
import { getCurrentUser, getEffectiveGroupPermissions, isAuthenticated, isMaster, setCachedGroupPermissions } from "@rh/lib/auth";
import { getEphemeralStorageItem, setEphemeralStorageItem } from "@rh/lib/security-storage";
import { buildRepresentanteKey } from "@rh/lib/organico-representantes-policy";
import {
  canAccessOrganicoSector,
  canCreateOrganicoComments,
  canDeleteOrganicoComments,
  canEditOrganicoPhotos,
  canEditRoute,
  canViewOrganicoComments,
  canViewOrganicoPhotos,
  canDeleteOrganicoPhotos,
  canJustificarAlteracoesSecullum,
  resolveVisibleOrganicoTabIds,
  resolveEditableOrganicoTabIds,
  canNotificarCadastroComplementarSecullum,
} from "@rh/lib/route-permissions";
import {
  rowToReplaceRow,
  ORGANICO_IDX,
  getTempoEmpresaMeses,
  getStatusFromRow,
} from "./organico-derive";
import { ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { useOrganicoImport, type OrganicoSheetRow } from "./useOrganicoImport";
import { FormFuncionarioModal, type FormFuncionarioModalSavePayload } from "./FormFuncionarioModal";
import { calcularFormulasRow } from "./organico-formulas";
import {
  buildExportMeta,
  sortRowsByMatricula,
  validateOrganicoImport,
  type OrganicoImportValidationResult,
} from "./organico-import-validate";
import {
  changeLogEntryToActivityDraft,
  groupChangeLogByMatricula,
} from "./organico-import-change-log";
import { OrganicoImportPreviewDialog, type OrganicoImportConfirmPhase } from "./OrganicoImportPreviewDialog";
import { collectNovosColaboradoresSecullumCadastroComplementar, mergeSecullumIntoRows } from "./organico-secullum-merge";
import {
  collectSecullumPendingFieldChanges,
  collectSecullumSyncChanges,
  type OrganicoActivityDraft,
} from "./organico-activity-log";
import { ORGANICO_DETALHE_ORIGEM_API_SECULLUM } from "./organico-secullum-readonly";
import { OrganicoCard } from "./OrganicoCard";
import {
  OrganicoRepresentanteCard,
  EMPTY_ORGANICO_REPRESENTANTE_DRAFT,
  ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
  type OrganicoRepresentanteDraft,
} from "./OrganicoRepresentanteCard";
import { FormRepresentanteModal } from "./FormRepresentanteModal";
import {
  OrganicoSecullumPendenciasBanner,
  OrganicoSecullumPendenciasDialog,
} from "./OrganicoSecullumPendenciasPanel";
import {
  ORGANICO_CARD_VIEW_STORAGE_KEY,
  ORGANICO_CARD_VIEW_OPTIONS,
  parseOrganicoCardViewMode,
  organicoListContainerClass,
  type OrganicoCardViewMode,
} from "./organico-card-view";

const TODOS = "Todos";
const ORGANICO_SHOW_CUSTO_STORAGE_KEY = "organico:showCustoTotal";
const ORGANICO_REPRESENTANTES_DRAFTS_STORAGE_KEY = "organico:representantes:drafts";
const STATUS_FILTER_OPTIONS = ["Ativos", "Férias", "Afastados", "Desligados"] as const;
const ORGANICO_EMPRESA_PADRAO = "SÓ AÇO INDUSTRIAL LTDA";
type OrganicoEmpresaTab = string;
const ORGANICO_DIRETORIA_IDX = 17;
const ORGANICO_SO_ACO_SUBTABS = ["Funcionários", "Representantes"] as const;
const ORGANICO_SETOR_OPTION_DESCRIPTIONS: Record<string, string> = {
  [ORGANICO_REPRESENTANTE_DEFAULT_SETOR]: "Externo - representantes",
};

const VIEW_MODE_ICONS: Record<OrganicoCardViewMode, ComponentType<{ className?: string }>> = {
  "extra-large": Maximize2,
  large: Square,
  medium: LayoutGrid,
  small: Grid3x3,
  list: List,
  details: Table2,
};

function readStoredCardViewMode(): OrganicoCardViewMode {
  try {
    const saved = parseOrganicoCardViewMode(localStorage.getItem(ORGANICO_CARD_VIEW_STORAGE_KEY));
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return "medium";
}

function uniqueOptionsFromRows(
  rows: OrganicoSheetRow[],
  colIndex: number,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const v = String(row[colIndex] ?? "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function appendUniqueOption(options: string[], option: string): string[] {
  if (options.includes(option)) return options;
  return [...options, option].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function rowMatchesStatusFilter(row: OrganicoSheetRow, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const status = getStatusFromRow(row);
  return selected.some((option) => {
    switch (option) {
      case "Ativos":
        return status === "Ativo";
      case "Férias":
        return status === "Férias";
      case "Afastados":
        return status === "Afastado";
      case "Desligados":
        return status === "Desligado";
      default:
        return false;
    }
  });
}

function toggleMultiOption(selected: string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

function getMultiLabel(selected: string[]): string {
  if (selected.length === 0) return TODOS;
  if (selected.length === 1) return selected[0]!;
  return `${selected.length} selecionados`;
}

/** Remove valores inválidos sem apagar seleção enquanto as opções ainda não carregaram. */
function pruneSelectedFilterValues(prev: string[], allowed: string[]): string[] {
  if (allowed.length === 0) return prev;
  const next = prev.filter((v) => allowed.includes(v));
  return next.length === prev.length ? prev : next;
}


function normalizeEmpresaText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

function normalizeEmpresaTabName(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return ORGANICO_EMPRESA_PADRAO;
  const norm = normalizeEmpresaText(raw);
  if (norm.includes("SO ACO") || norm.includes("ACO INDUSTRIAL")) return ORGANICO_EMPRESA_PADRAO;
  if (norm.includes("SO MOVEIS") || norm.includes("MOVEIS")) return "SÓ MÓVEIS";
  return raw;
}

function resolveEmpresaTabFromRow(row: OrganicoSheetRow): OrganicoEmpresaTab {
  const setor = normalizeEmpresaText(String(row[ORGANICO_IDX.SETOR] ?? "").trim());
  const area = normalizeEmpresaText(String(row[ORGANICO_IDX.AREA] ?? "").trim());
  const diretoria = normalizeEmpresaText(String(row[ORGANICO_DIRETORIA_IDX] ?? "").trim());

  const joined = `${setor} ${area} ${diretoria}`;
  if (joined.includes("MOVEIS") || joined.includes("MOVEL")) return normalizeEmpresaTabName("SÓ MÓVEIS");
  return ORGANICO_EMPRESA_PADRAO;
}

function resolveEmpresaTabFromApiFuncionario(
  f: Awaited<ReturnType<typeof getSecullumFuncionarios>>[number],
): OrganicoEmpresaTab {
  const empresaNomeDireta = String(f.empresaNome ?? "").trim();
  if (empresaNomeDireta) return normalizeEmpresaTabName(empresaNomeDireta);

  const raw = f as unknown as Record<string, unknown>;
  const estrutura = String(raw?.Estrutura && typeof raw.Estrutura === "object"
    ? (raw.Estrutura as Record<string, unknown>).Descricao ?? ""
    : "").trim();
  const departamento = String(raw?.Departamento && typeof raw.Departamento === "object"
    ? (raw.Departamento as Record<string, unknown>).Descricao ?? ""
    : "").trim();
  const empresa = String(
    raw?.EmpresaDescricao ??
      raw?.empresaDescricao ??
      raw?.Empresa ??
      raw?.empresa ??
      raw?.FilialDescricao ??
      raw?.filialDescricao ??
      "",
  ).trim();
  const joined = normalizeEmpresaText(
    `${empresa} ${estrutura} ${departamento} ${String(f.area ?? "")} ${String(f.setor ?? "")}`,
  );
  if (joined.includes("MOVEIS") || joined.includes("MOVEL")) return normalizeEmpresaTabName("SÓ MÓVEIS");
  return ORGANICO_EMPRESA_PADRAO;
}

/** Para montar opções de um multiselect: aplica os demais filtros em cascata (exceto a dimensão `exclude`). */
type OrganicoFilterOptionExclude =
  | "cargo"
  | "setor"
  | "area"
  | "gestorImediato"
  | "gestorMediato"
  | "grauInstrucao";

function applyOrganicoFilterContext(
  rows: OrganicoSheetRow[],
  args: {
    statusFilter: string[];
    nomeFilter: string;
    filterCargo: string[];
    filterSetor: string[];
    filterArea: string[];
    filterGestorImediato: string[];
    filterGestorMediato: string[];
    filterGrauInstrucao: string[];
    exclude: OrganicoFilterOptionExclude | null;
  },
): OrganicoSheetRow[] {
  let items = rows.filter((row) => rowMatchesStatusFilter(row, args.statusFilter));

  if (args.nomeFilter.trim()) {
    const q = args.nomeFilter.trim();
    items = items.filter((row) => textMatchesSearchQuery(String(row[ORGANICO_IDX.NOME] ?? ""), q));
  }

  const cellStr = (row: OrganicoSheetRow, i: number) => String(row[i] ?? "").trim();

  if (args.exclude !== "cargo" && args.filterCargo.length > 0) {
    const set = new Set(args.filterCargo);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.CARGO)));
  }
  if (args.exclude !== "setor" && args.filterSetor.length > 0) {
    const set = new Set(args.filterSetor);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.SETOR)));
  }
  if (args.exclude !== "area" && args.filterArea.length > 0) {
    const set = new Set(args.filterArea);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.AREA)));
  }
  if (args.exclude !== "gestorImediato" && args.filterGestorImediato.length > 0) {
    const set = new Set(args.filterGestorImediato);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_IMEDIATO)));
  }
  if (args.exclude !== "gestorMediato" && args.filterGestorMediato.length > 0) {
    const set = new Set(args.filterGestorMediato);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_MEDIATO)));
  }
  if (args.exclude !== "grauInstrucao" && args.filterGrauInstrucao.length > 0) {
    const set = new Set(args.filterGrauInstrucao);
    items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GRAU_INSTRUCAO)));
  }

  return items;
}

function stopMenuKeyboardCapture(e: ReactKeyboardEvent): void {
  e.stopPropagation();
}

function MultiSelectFilter({
  options,
  selected,
  onChange,
  optionDescriptions,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  optionDescriptions?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => textMatchesSearchQuery(o, q));
  }, [options, query]);

  const scopeIsFiltered = query.trim().length > 0;
  const allInScopeSelected =
    filtered.length > 0 && filtered.every((o) => selected.includes(o));
  const bulkLabel = scopeIsFiltered
    ? allInScopeSelected
      ? "Desmarcar visíveis"
      : "Marcar visíveis"
    : allInScopeSelected && options.length > 0
      ? "Desmarcar todos"
      : "Marcar todos";

  const handleBulkToggle = (): void => {
    if (filtered.length === 0) return;
    if (scopeIsFiltered) {
      if (allInScopeSelected) {
        const drop = new Set(filtered);
        onChange(selected.filter((s) => !drop.has(s)));
      } else {
        onChange(Array.from(new Set([...selected, ...filtered])));
      }
      return;
    }
    if (selected.length === options.length) onChange([]);
    else onChange([...options]);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-between text-sm font-normal">
          <span className="truncate">{getMultiLabel(selected)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(92vw,380px)] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }}
      >
        <div
          className="border-b border-border p-2"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={stopMenuKeyboardCapture}
        >
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={stopMenuKeyboardCapture}
            placeholder="Pesquisar..."
            className="h-8 w-full rounded-sm border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <DropdownMenuCheckboxItem
            checked={filtered.length > 0 && allInScopeSelected}
            disabled={filtered.length === 0}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={handleBulkToggle}
          >
            {bulkLabel}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
          ) : (
            filtered.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt}
                checked={selected.includes(opt)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onChange(toggleMultiOption(selected, opt))}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="break-words whitespace-normal">{opt}</span>
                  {optionDescriptions?.[opt] ? (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {optionDescriptions[opt]}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildComentarioKey(matricula: string, nome: string): string {
  const mat = matricula.trim();
  if (mat) return `mat:${mat}`;
  return `nome:${nome.trim().toLocaleUpperCase("pt-BR")}`;
}

function representanteKeyOf(rep: Pick<OrganicoRepresentante, "representanteKey" | "nome" | "nomeRazaoSocial">): string {
  return rep.representanteKey || buildRepresentanteKey(rep.nome, rep.nomeRazaoSocial);
}

function readStoredRepresentanteDrafts(): Record<string, OrganicoRepresentanteDraft> {
  try {
    const raw = getEphemeralStorageItem(ORGANICO_REPRESENTANTES_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<OrganicoRepresentanteDraft>>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, OrganicoRepresentanteDraft> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = {
        ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT,
        ...(v ?? {}),
        setor: String(v?.setor ?? "").trim() || ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
      };
    }
    return out;
  } catch {
    return {};
  }
}

const organicoFiltersStoreRef = { current: null as ReturnType<typeof readOrganicoFiltersStore> | null };
function getOrganicoFiltersStore() {
  if (!organicoFiltersStoreRef.current) {
    organicoFiltersStoreRef.current = readOrganicoFiltersStore();
  }
  return organicoFiltersStoreRef.current;
}

const Organico = () => {
  const location = useLocation();
  organicoFiltersStoreRef.current = readOrganicoFiltersStore();
  const initialOrganicoStore = organicoFiltersStoreRef.current;
  const initialOrganicoScope = initialOrganicoStore.byScope[
    buildOrganicoScopeKey(initialOrganicoStore.empresaTab, initialOrganicoStore.soAcoSubTab)
  ] ?? ORGANICO_SCOPE_DEFAULTS;

  const [data, setData] = useState<OrganicoSheetRow[]>([]);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("edit");
  const [statusFilter, setStatusFilter] = useState<string[]>(initialOrganicoScope.statusFilter);
  const [nomeFilter, setNomeFilter] = useState(initialOrganicoScope.nomeFilter);
  const [sortNome, setSortNome] = useState<"padrao" | "nome_asc" | "nome_desc">(initialOrganicoScope.sortNome);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [showCustoTotal, setShowCustoTotal] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ORGANICO_SHOW_CUSTO_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [custoRevealedKeys, setCustoRevealedKeys] = useState<Set<string>>(() => new Set());
  const [custoHiddenKeys, setCustoHiddenKeys] = useState<Set<string>>(() => new Set());
  const [filterCargo, setFilterCargo] = useState<string[]>(initialOrganicoScope.filterCargo);
  const [filterSetor, setFilterSetor] = useState<string[]>(initialOrganicoScope.filterSetor);
  const [filterArea, setFilterArea] = useState<string[]>(initialOrganicoScope.filterArea);
  const [filterGestorImediato, setFilterGestorImediato] = useState<string[]>(initialOrganicoScope.filterGestorImediato);
  const [filterGestorMediato, setFilterGestorMediato] = useState<string[]>(initialOrganicoScope.filterGestorMediato);
  const [filterGrauInstrucao, setFilterGrauInstrucao] = useState<string[]>(initialOrganicoScope.filterGrauInstrucao);
  const [filterMotivoDemissao, setFilterMotivoDemissao] = useState<string[]>(initialOrganicoScope.filterMotivoDemissao);
  const [sortTempoEmpresa, setSortTempoEmpresa] = useState<"padrao" | "tempo_desc" | "tempo_asc">(
    initialOrganicoScope.sortTempoEmpresa,
  );
  const [syncSecullumLoading, setSyncSecullumLoading] = useState(false);
  const [demissaoByMatricula, setDemissaoByMatricula] = useState<Record<string, string>>({});
  const demissaoByMatriculaRef = useRef(demissaoByMatricula);
  demissaoByMatriculaRef.current = demissaoByMatricula;
  const [motivoDemissaoByMatricula, setMotivoDemissaoByMatricula] = useState<Record<string, string>>({});
  const [cardViewMode, setCardViewMode] = useState<OrganicoCardViewMode>(() => readStoredCardViewMode());
  const [selectedEmpresaTab, setSelectedEmpresaTab] = useState<OrganicoEmpresaTab>(initialOrganicoStore.empresaTab);
  const [selectedSoAcoSubTab, setSelectedSoAcoSubTab] = useState<(typeof ORGANICO_SO_ACO_SUBTABS)[number]>(
    initialOrganicoStore.soAcoSubTab,
  );
  const [representanteDraftsByKey, setRepresentanteDraftsByKey] = useState<Record<string, OrganicoRepresentanteDraft>>(
    () => readStoredRepresentanteDrafts(),
  );
  const [representanteModalOpen, setRepresentanteModalOpen] = useState(false);
  const [representanteModalMode, setRepresentanteModalMode] = useState<"view" | "edit">("edit");
  const [editingRepresentanteKey, setEditingRepresentanteKey] = useState<string | null>(null);
  const [editingRepresentanteNome, setEditingRepresentanteNome] = useState<string>("");
  const [editingRepresentanteRazaoSocial, setEditingRepresentanteRazaoSocial] = useState<string>("");
  const [highlightMatricula, setHighlightMatricula] = useState<string>("");
  const [nomeDropdownOpen, setNomeDropdownOpen] = useState(false);
  const { parseFile, exportToExcel } = useOrganicoImport();
  const { toast } = useToast();
  const { runWithSaving } = useSavingOverlay();
  const canEditOrganico = canEditRoute("/organico");
  const canViewComments = canViewOrganicoComments();
  const canCreateComments = canCreateOrganicoComments();
  const canDeleteComments = canDeleteOrganicoComments();
  const canViewPhotos = canViewOrganicoPhotos();
  const canEditPhotos = canEditOrganicoPhotos();
  const canDeletePhotos = canDeleteOrganicoPhotos();

  const { data: sessionPermissionsSynced } = useQuery({
    queryKey: ["rh-session-permissions"],
    queryFn: async () => {
      const p = await getRhSessionPermissions();
      setCachedGroupPermissions(p);
      return p;
    },
    enabled: isApiConfigured() && isAuthenticated() && !isMaster(),
    staleTime: 60_000,
  });

  const masterUser = isMaster();
  const effectiveGroupPermissions = masterUser ? null : sessionPermissionsSynced ?? getEffectiveGroupPermissions();
  const allowedTabIds = resolveVisibleOrganicoTabIds(effectiveGroupPermissions, masterUser);
  const editableTabIds = resolveEditableOrganicoTabIds(effectiveGroupPermissions, masterUser, canEditOrganico);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nomeFilterWrapRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<OrganicoSheetRow[]>([]);
  const queryClient = useQueryClient();

  const { data: apiRows, isLoading: loadingOrganico, isError: errorOrganico, refetch: refetchOrganico } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
  });

  const isSoAcoTabActive = selectedEmpresaTab === ORGANICO_EMPRESA_PADRAO;
  const showingRepresentantes = isSoAcoTabActive && selectedSoAcoSubTab === "Representantes";
  const showingFuncionarios = !showingRepresentantes;
  const shouldShowRepresentantesInFuncionarios =
    showingFuncionarios && filterSetor.includes(ORGANICO_REPRESENTANTE_DEFAULT_SETOR);

  const {
    data: representantesData,
    isLoading: loadingRepresentantes,
    isError: errorRepresentantes,
    error: representantesError,
    refetch: refetchRepresentantes,
  } = useQuery<OrganicoRepresentante[]>({
    queryKey: ["organico-representantes-ativos"],
    queryFn: getOrganicoRepresentantesAtivos,
    enabled: showingRepresentantes || shouldShowRepresentantesInFuncionarios,
    staleTime: 5 * 60 * 1000,
  });

  const buildOrganicoScopeSnapshot = useCallback(
    (): OrganicoFilterScopeState => ({
      statusFilter,
      nomeFilter,
      sortNome,
      filterCargo,
      filterSetor,
      filterArea,
      filterGestorImediato,
      filterGestorMediato,
      filterGrauInstrucao,
      filterMotivoDemissao,
      sortTempoEmpresa,
    }),
    [
      statusFilter,
      nomeFilter,
      sortNome,
      filterCargo,
      filterSetor,
      filterArea,
      filterGestorImediato,
      filterGestorMediato,
      filterGrauInstrucao,
      filterMotivoDemissao,
      sortTempoEmpresa,
    ],
  );

  const applyOrganicoScopeFilters = useCallback((scope: OrganicoFilterScopeState) => {
    setStatusFilter(scope.statusFilter);
    setNomeFilter(scope.nomeFilter);
    setSortNome(scope.sortNome);
    setFilterCargo(scope.filterCargo);
    setFilterSetor(scope.filterSetor);
    setFilterArea(scope.filterArea);
    setFilterGestorImediato(scope.filterGestorImediato);
    setFilterGestorMediato(scope.filterGestorMediato);
    setFilterGrauInstrucao(scope.filterGrauInstrucao);
    setFilterMotivoDemissao(scope.filterMotivoDemissao);
    setSortTempoEmpresa(scope.sortTempoEmpresa);
  }, []);

  const handleSelectEmpresaTab = useCallback(
    (empresa: OrganicoEmpresaTab) => {
      if (empresa === selectedEmpresaTab) return;
      const store = getOrganicoFiltersStore();
      const currentKey = buildOrganicoScopeKey(selectedEmpresaTab, selectedSoAcoSubTab);
      store.byScope[currentKey] = buildOrganicoScopeSnapshot();
      const nextKey = buildOrganicoScopeKey(empresa, selectedSoAcoSubTab);
      store.empresaTab = empresa;
      applyOrganicoScopeFilters(store.byScope[nextKey] ?? ORGANICO_SCOPE_DEFAULTS);
      writeOrganicoFiltersStore(store);
      setSelectedEmpresaTab(empresa);
    },
    [applyOrganicoScopeFilters, buildOrganicoScopeSnapshot, selectedEmpresaTab, selectedSoAcoSubTab],
  );

  const handleSelectSoAcoSubTab = useCallback(
    (subTab: OrganicoSoAcoSubTab) => {
      if (subTab === selectedSoAcoSubTab) return;
      const store = getOrganicoFiltersStore();
      const currentKey = buildOrganicoScopeKey(selectedEmpresaTab, selectedSoAcoSubTab);
      store.byScope[currentKey] = buildOrganicoScopeSnapshot();
      const nextKey = buildOrganicoScopeKey(selectedEmpresaTab, subTab);
      store.soAcoSubTab = subTab;
      applyOrganicoScopeFilters(store.byScope[nextKey] ?? ORGANICO_SCOPE_DEFAULTS);
      writeOrganicoFiltersStore(store);
      setSelectedSoAcoSubTab(subTab);
    },
    [applyOrganicoScopeFilters, buildOrganicoScopeSnapshot, selectedEmpresaTab, selectedSoAcoSubTab],
  );

  useEffect(() => {
    const store = getOrganicoFiltersStore();
    const scopeKey = buildOrganicoScopeKey(selectedEmpresaTab, selectedSoAcoSubTab);
    store.empresaTab = selectedEmpresaTab;
    store.soAcoSubTab = selectedSoAcoSubTab;
    store.byScope[scopeKey] = buildOrganicoScopeSnapshot();
    writeOrganicoFiltersStore(store);
  }, [
    buildOrganicoScopeSnapshot,
    statusFilter,
    nomeFilter,
    sortNome,
    filterCargo,
    filterSetor,
    filterArea,
    filterGestorImediato,
    filterGestorMediato,
    filterGrauInstrucao,
    filterMotivoDemissao,
    sortTempoEmpresa,
    selectedEmpresaTab,
    selectedSoAcoSubTab,
  ]);

  useEffect(() => {
    try {
      setEphemeralStorageItem(
        ORGANICO_REPRESENTANTES_DRAFTS_STORAGE_KEY,
        JSON.stringify(representanteDraftsByKey),
      );
    } catch {
      /* ignore */
    }
  }, [representanteDraftsByKey]);

  useEffect(() => {
    const list = representantesData ?? [];
    if (list.length === 0) return;
    setRepresentanteDraftsByKey((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const rep of list) {
        const key = rep.representanteKey || representanteKeyOf(rep);
        if (!key) continue;
        const fromApi: OrganicoRepresentanteDraft = {
          ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT,
          fotoBase64: String(rep.fotoBase64 ?? ""),
          fotoMimeType: String(rep.fotoMimeType ?? ""),
          cpf: String(rep.cpf ?? ""),
          admissao: String(rep.admissao ?? ""),
          tempoEmpresa: String(rep.tempoEmpresa ?? ""),
          cargo: String(rep.cargo ?? ""),
          setor: String(rep.setor ?? "").trim() || ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
          area: String(rep.area ?? ""),
          nascimento: String(rep.nascimento ?? ""),
          idade: String(rep.idade ?? ""),
          grauInstrucao: String(rep.grauInstrucao ?? ""),
          vinculo: String(rep.vinculo ?? ""),
          telefone: String(rep.telefone ?? ""),
          telefoneEmergencial: String(rep.telefoneEmergencial ?? ""),
          agencia: String(rep.agencia ?? ""),
          conta: String(rep.conta ?? ""),
          banco: String(rep.banco ?? ""),
          chavePix: String(rep.chavePix ?? ""),
          casoNaoTenhaPix: String(rep.casoNaoTenhaPix ?? ""),
        };
        const hasSavedData = Object.values(fromApi).some((value) => String(value ?? "").trim() !== "");
        // Se ainda não há dados no banco, preserva qualquer preenchimento local já feito antes da migração.
        if (!hasSavedData && next[key]) continue;
        if (JSON.stringify(next[key] ?? null) !== JSON.stringify(fromApi)) {
          next[key] = fromApi;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [representantesData]);

  const { data: secullumEmpresaByMatricula = {}, isFetched: secullumEmpresaByMatriculaFetched } = useQuery({
    queryKey: ["secullum-empresa-by-matricula"],
    queryFn: async () => {
      const list = await getSecullumFuncionarios();
      const map: Record<string, OrganicoEmpresaTab> = {};
      for (const f of list) {
        const rawMat = String(f.numeroFolha ?? "").trim();
        if (!rawMat) continue;
        const empresa = resolveEmpresaTabFromApiFuncionario(f);
        map[rawMat] = empresa;
        map[normalizeMatriculaFolha(rawMat)] = empresa;
      }
      return map;
    },
    enabled: isApiConfigured(),
    staleTime: 9 * 60 * 1000,
    retry: 1,
  });

  const secullumMatriculaSet = useMemo(
    () => new Set(Object.keys(secullumEmpresaByMatricula)),
    [secullumEmpresaByMatricula],
  );
  const secullumMatriculasFetched = secullumEmpresaByMatriculaFetched;

  const { data: comentariosResumo } = useQuery({
    queryKey: ["organico-comentarios-resumo"],
    queryFn: getOrganicoComentariosResumo,
    enabled: isApiConfigured() && canViewComments,
    staleTime: 60 * 1000,
  });

  const { data: fotosResumo } = useQuery({
    queryKey: ["organico-fotos-resumo"],
    queryFn: getOrganicoFotosResumo,
    enabled: isApiConfigured() && canViewPhotos,
    staleTime: 60 * 1000,
  });

  const canJustificarSecullum = canJustificarAlteracoesSecullum();
  const [pendenciasDialogOpen, setPendenciasDialogOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewFileName, setImportPreviewFileName] = useState("");
  const [importValidation, setImportValidation] = useState<OrganicoImportValidationResult | null>(null);
  const [importConfirmPhase, setImportConfirmPhase] = useState<OrganicoImportConfirmPhase>("idle");

  const { data: secullumPendencias = [] } = useQuery({
    queryKey: ["organico-alteracoes-pendentes"],
    queryFn: getOrganicoAlteracoesPendentes,
    enabled: isApiConfigured() && canJustificarSecullum,
    staleTime: 30 * 1000,
  });

  const pendenciasFiltradasSetor = useMemo(() => {
    return secullumPendencias.filter((p) => canAccessOrganicoSector(p.setor));
  }, [secullumPendencias]);

  const matriculasComPendenciaSecullum = useMemo(() => {
    const s = new Set<string>();
    for (const p of pendenciasFiltradasSetor) {
      const m = String(p.colaboradorMatricula ?? "").trim();
      if (m) s.add(m);
    }
    return s;
  }, [pendenciasFiltradasSetor]);

  const resolvePendenciaMutation = useMutation({
    mutationFn: resolveOrganicoAlteracaoPendente,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organico-alteracoes-pendentes"] });
      await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
      await queryClient.invalidateQueries({ queryKey: ["organico-comentarios"] });
      await queryClient.invalidateQueries({ queryKey: ["organico-trajetoria"] });
      toast({ title: "Motivo registrado", description: "Trajetória e histórico foram atualizados." });
    },
    onError: (e: Error) => {
      toast({ title: "Não foi possível registrar", description: e.message, variant: "destructive" });
    },
  });

  const dismissPendenciaMutation = useMutation({
    mutationFn: deleteOrganicoAlteracaoPendente,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organico-alteracoes-pendentes"] });
      await queryClient.invalidateQueries({ queryKey: ["organico-trajetoria"] });
      toast({
        title: "Pendência excluída",
        description: "A justificativa não é mais exigida para este registro.",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Não foi possível excluir a pendência", description: e.message, variant: "destructive" });
    },
  });

  const pendenciaBusyId =
    resolvePendenciaMutation.isPending && resolvePendenciaMutation.variables
      ? String((resolvePendenciaMutation.variables as { id: string }).id ?? "")
      : dismissPendenciaMutation.isPending && dismissPendenciaMutation.variables
        ? String((dismissPendenciaMutation.variables as { id: string }).id ?? "")
        : null;

  const pendenciaPendingAction =
    resolvePendenciaMutation.isPending ? ("resolve" as const) : dismissPendenciaMutation.isPending ? ("dismiss" as const) : null;

  const secullumFieldsLocked = useMemo(() => {
    if (!isApiConfigured() || editingRowIndex == null) return false;
    if (!secullumMatriculasFetched) return false;
    const row = data[editingRowIndex];
    if (!row || !Array.isArray(row)) return false;
    const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!mat) return false;
    const detalheIdx = ORGANICO_NUM_COLUNAS - 1;
    const origemApi = String(row[detalheIdx] ?? "").trim() === ORGANICO_DETALHE_ORIGEM_API_SECULLUM;
    const set = secullumMatriculaSet ?? new Set<string>();
    return origemApi || secullumMatriculaSetMatchesOrganico(set, mat);
  }, [editingRowIndex, data, secullumMatriculaSet, secullumMatriculasFetched]);

  const comentarioKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const item of comentariosResumo ?? []) {
      const matricula = String(item.colaboradorMatricula ?? "").trim();
      const nome = String(item.colaboradorNome ?? "").trim();
      if (!matricula && !nome) continue;
      set.add(buildComentarioKey(matricula, nome));
    }
    return set;
  }, [comentariosResumo]);

  /** Matrículas que possuem foto no banco (resumo sem base64 — leve). A imagem é buscada sob demanda no card. */
  const matriculasComFoto = useMemo(() => {
    const s = new Set<string>();
    for (const item of fotosResumo ?? []) {
      const matricula = String(item.colaboradorMatricula ?? "").trim();
      if (matricula) s.add(matricula);
    }
    return s;
  }, [fotosResumo]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const visibleData = useMemo(
    () => data.filter((row) => {
      const setor = String(row[ORGANICO_IDX.SETOR] ?? "").trim();
      if (!canAccessOrganicoSector(setor)) return false;
      const isRepresentante = setor === ORGANICO_REPRESENTANTE_DEFAULT_SETOR;
      if (!isRepresentante && secullumMatriculasFetched) {
        const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
        if (!mat || !secullumMatriculaSetMatchesOrganico(secullumMatriculaSet, mat)) return false;
      }
      const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
      const matNorm = normalizeMatriculaFolha(mat);
      const empresaFromApi = secullumEmpresaByMatricula[mat] ?? secullumEmpresaByMatricula[matNorm];
      const empresa = empresaFromApi ?? resolveEmpresaTabFromRow(row);
      return empresa === selectedEmpresaTab;
    }),
    [data, selectedEmpresaTab, secullumEmpresaByMatricula, secullumMatriculasFetched, secullumMatriculaSet],
  );

  const empresaTabsEnabled = useMemo(() => {
    const enabled = new Set<OrganicoEmpresaTab>();
    for (const row of data) {
      const setor = String(row[ORGANICO_IDX.SETOR] ?? "").trim();
      if (!canAccessOrganicoSector(setor)) continue;
      const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
      const matNorm = normalizeMatriculaFolha(mat);
      const empresaFromApi = secullumEmpresaByMatricula[mat] ?? secullumEmpresaByMatricula[matNorm];
      enabled.add(empresaFromApi ?? resolveEmpresaTabFromRow(row));
    }
    return enabled;
  }, [data, secullumEmpresaByMatricula]);

  const empresaTabs = useMemo(() => {
    const tabs = new Set<OrganicoEmpresaTab>();
    tabs.add(ORGANICO_EMPRESA_PADRAO);
    for (const tab of empresaTabsEnabled) tabs.add(tab);
    return Array.from(tabs).sort((a, b) => {
      if (a === ORGANICO_EMPRESA_PADRAO) return -1;
      if (b === ORGANICO_EMPRESA_PADRAO) return 1;
      return a.localeCompare(b, "pt-BR");
    });
  }, [empresaTabsEnabled]);

  useEffect(() => {
    if (empresaTabs.includes(selectedEmpresaTab)) return;
    handleSelectEmpresaTab(empresaTabs[0] ?? ORGANICO_EMPRESA_PADRAO);
  }, [empresaTabs, selectedEmpresaTab, handleSelectEmpresaTab]);

  const applySecullumSync = useCallback(
    async (
      funcionarios: Awaited<ReturnType<typeof getSecullumFuncionarios>>,
      options?: { actor?: string },
    ) => {
      const prevRows = dataRef.current;
      const mergedRows = mergeSecullumIntoRows(prevRows, funcionarios);
      const apiMatriculas = new Set(
        funcionarios.map((f) => String(f.numeroFolha ?? "").trim()).filter(Boolean),
      );
      const nextRows = mergedRows.filter((row) => {
        const setor = String(row[ORGANICO_IDX.SETOR] ?? "").trim();
        if (setor === ORGANICO_REPRESENTANTE_DEFAULT_SETOR) return true;
        const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
        return Boolean(mat) && secullumMatriculaSetMatchesOrganico(apiMatriculas, mat);
      });
      const removidosForaApi = Math.max(0, mergedRows.length - nextRows.length);
      const changes = collectSecullumSyncChanges(prevRows, nextRows);
      const actor = options?.actor?.trim() || "API Secullum";

      setData(nextRows);
      dataRef.current = nextRows;

      const map: Record<string, string> = {};
      const motivoMap: Record<string, string> = {};
      for (const f of funcionarios) {
        const mat = String(f.numeroFolha ?? "").trim();
        if (!mat) continue;
        if (f.demissao) map[mat] = f.demissao;
        const md = String(f.motivoDemissao ?? "").trim();
        if (md) motivoMap[mat] = md;
      }
      setDemissaoByMatricula(map);
      setMotivoDemissaoByMatricula(motivoMap);

      const novosCadastroComplementar = collectNovosColaboradoresSecullumCadastroComplementar(
        prevRows,
        nextRows,
      ).filter((n) => {
        const row = nextRows.find((r) => String(r[ORGANICO_IDX.MATRICULA] ?? "").trim() === n.matricula);
        if (!row) return false;
        return canAccessOrganicoSector(String(row[ORGANICO_IDX.SETOR] ?? "").trim());
      });
      if (
        novosCadastroComplementar.length > 0 &&
        prevRows.length > 0 &&
        canNotificarCadastroComplementarSecullum()
      ) {
        const count = novosCadastroComplementar.length;
        toast({
          title:
            count === 1 ? "Novo colaborador (Secullum)" : `${count} novos colaboradores (Secullum)`,
          description:
            count === 1
              ? `${novosCadastroComplementar[0].nome} (mat. ${novosCadastroComplementar[0].matricula}) — complete o cadastro complementar no Orgânico.`
              : `${novosCadastroComplementar
                  .slice(0, 3)
                  .map((x) => x.nome)
                  .join(", ")}${count > 3 ? "…" : ""} — cadastro complementar pendente no Orgânico.`,
        });
      }

      if (changes.length === 0 && removidosForaApi === 0) {
        return { changedRows: 0, logCount: 0, removedRows: 0 };
      }

      await runWithSaving(
        () => replaceOrganico(nextRows.map((row) => rowToReplaceRow(row))),
        "Sincronizando orgânico…",
      );

      const pendenciaItems: Array<{
        matricula: string;
        colaboradorNome: string;
        setor: string;
        tipo: "ctps" | "cargo";
        campoLabel: string;
        valorAnterior: string;
        valorAtual: string;
      }> = [];
      for (const { previousRow, nextRow } of changes) {
        const fieldChanges = collectSecullumPendingFieldChanges(previousRow, nextRow);
        if (fieldChanges.length === 0) continue;
        const matricula = String(nextRow[ORGANICO_IDX.MATRICULA] ?? "").trim();
        const nome = String(nextRow[ORGANICO_IDX.NOME] ?? "").trim();
        const setor = String(nextRow[ORGANICO_IDX.SETOR] ?? "").trim();
        if (!matricula && !nome) continue;
        for (const f of fieldChanges) {
          pendenciaItems.push({
            matricula,
            colaboradorNome: nome || "—",
            setor,
            tipo: f.tipo,
            campoLabel: f.campoLabel,
            valorAnterior: f.valorAnterior,
            valorAtual: f.valorAtual,
          });
        }
      }
      if (pendenciaItems.length > 0 && isApiConfigured()) {
        try {
          await upsertOrganicoAlteracoesPendentes({ items: pendenciaItems });
          await queryClient.invalidateQueries({ queryKey: ["organico-alteracoes-pendentes"] });
          await queryClient.invalidateQueries({ queryKey: ["organico-trajetoria"] });
        } catch {
          /* pendências são complementares; não bloquear sync Secullum */
        }
      }

      let logCount = 0;
      const logTargets = changes.filter(({ nextRow, activityLogs }) => {
        const matricula = String(nextRow[ORGANICO_IDX.MATRICULA] ?? "").trim();
        const nome = String(nextRow[ORGANICO_IDX.NOME] ?? "").trim();
        return Boolean(matricula || nome) && activityLogs.length > 0;
      });

      if (logTargets.length > 0) {
        await Promise.all(
          logTargets.map(async ({ nextRow, activityLogs }) => {
            const matricula = String(nextRow[ORGANICO_IDX.MATRICULA] ?? "").trim();
            const nome = String(nextRow[ORGANICO_IDX.NOME] ?? "").trim();
            await addOrganicoAtividades({
              matricula,
              colaboradorNome: nome,
              createdBy: actor,
              entries: activityLogs,
            });
            logCount += activityLogs.length;
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
        await queryClient.invalidateQueries({ queryKey: ["organico-comentarios"] });
      }

      await queryClient.invalidateQueries({ queryKey: ["organico"] });

      return {
        changedRows: changes.length,
        logCount,
        removedRows: removidosForaApi,
      };
    },
    [queryClient, toast, runWithSaving],
  );

  useEffect(() => {
    if (apiRows == null) return;
    const rows = Array.isArray(apiRows) ? apiRows : [];
    const parsed = rows.map((r) => {
      const arr = Array.isArray(r?.values) ? [...r.values] : [];
      while (arr.length < ORGANICO_NUM_COLUNAS) arr.push("");
      calcularFormulasRow(arr, { demissaoByMatricula: demissaoByMatriculaRef.current });
      return arr;
    });
    setData(parsed);

    if (!isApiConfigured()) return;

    const syncSecullum = () => {
      getSecullumFuncionarios()
        .then(async (funcionarios) => {
          await applySecullumSync(funcionarios, { actor: "API Secullum" });
          await queryClient.invalidateQueries({ queryKey: ["secullum-empresa-by-matricula"] });
        })
        .catch(() => {});
    };
    syncSecullum();

    const interval = setInterval(syncSecullum, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [apiRows, applySecullumSync, queryClient]);

  /** Recalcula tempo de empresa quando o mapa de demissões (Secullum) é preenchido ou atualizado. */
  useEffect(() => {
    setData((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((row) => {
        const arr = [...(Array.isArray(row) ? row : [])];
        while (arr.length < ORGANICO_NUM_COLUNAS) arr.push("");
        calcularFormulasRow(arr, { demissaoByMatricula });
        return arr;
      });
    });
  }, [demissaoByMatricula]);

  useEffect(() => {
    try {
      localStorage.setItem(ORGANICO_CARD_VIEW_STORAGE_KEY, cardViewMode);
    } catch {
      /* ignore */
    }
  }, [cardViewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(ORGANICO_SHOW_CUSTO_STORAGE_KEY, showCustoTotal ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [showCustoTotal]);

  useEffect(() => {
    if (!showCustoTotal) return;
    // Ao liberar globalmente, limpamos os reveals individuais (evita estado acumulado ao voltar a ocultar).
    setCustoRevealedKeys(new Set());
  }, [showCustoTotal]);

  useEffect(() => {
    if (showCustoTotal) return;
    // Ao ocultar globalmente, limpamos os hides individuais (evita estado acumulado ao voltar a exibir).
    setCustoHiddenKeys(new Set());
  }, [showCustoTotal]);

  const isCustoVisibleFor = useCallback(
    (matricula: string) => {
      const key = `mat:${matricula}`;
      if (showCustoTotal) return !custoHiddenKeys.has(key);
      return custoRevealedKeys.has(key);
    },
    [showCustoTotal, custoHiddenKeys, custoRevealedKeys]
  );

  const toggleCustoVisibilityFor = useCallback(
    (matricula: string) => {
      const key = `mat:${matricula}`;
      if (showCustoTotal) {
        setCustoHiddenKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }
      setCustoRevealedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [showCustoTotal]
  );

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (nomeFilter.trim()) n++;
    if (sortNome !== "padrao") n++;
    if (filterCargo.length > 0) n++;
    if (filterSetor.length > 0) n++;
    if (filterArea.length > 0) n++;
    if (filterGestorImediato.length > 0) n++;
    if (filterGestorMediato.length > 0) n++;
    if (filterGrauInstrucao.length > 0) n++;
    if (filterMotivoDemissao.length > 0) n++;
    if (sortTempoEmpresa !== "padrao") n++;
    if (!(statusFilter.length === 1 && statusFilter[0] === "Ativos")) n++;
    return n;
  }, [
    nomeFilter,
    sortNome,
    filterCargo,
    filterSetor,
    filterArea,
    filterGestorImediato,
    filterGestorMediato,
    filterGrauInstrucao,
    filterMotivoDemissao,
    sortTempoEmpresa,
    statusFilter,
  ]);

  const clearOrganicoFilters = useCallback(() => {
    applyOrganicoScopeFilters(ORGANICO_SCOPE_DEFAULTS);
    const store = getOrganicoFiltersStore();
    const scopeKey = buildOrganicoScopeKey(selectedEmpresaTab, selectedSoAcoSubTab);
    store.byScope[scopeKey] = { ...ORGANICO_SCOPE_DEFAULTS };
    writeOrganicoFiltersStore(store);
  }, [applyOrganicoScopeFilters, selectedEmpresaTab, selectedSoAcoSubTab]);

  const shouldShowMotivoDemissaoFilter = statusFilter.includes("Desligados");

  useEffect(() => {
    if (!shouldShowMotivoDemissaoFilter && filterMotivoDemissao.length > 0) {
      setFilterMotivoDemissao([]);
    }
  }, [shouldShowMotivoDemissaoFilter, filterMotivoDemissao.length]);

  const motivoDemissaoFilterOptions = useMemo(() => {
    if (!shouldShowMotivoDemissaoFilter) return [];
    const cellStr = (row: OrganicoSheetRow, i: number) => String(row[i] ?? "").trim();
    let items = visibleData.filter((row) => rowMatchesStatusFilter(row, statusFilter));
    if (nomeFilter.trim()) {
      const q = nomeFilter.trim();
      items = items.filter((row) => textMatchesSearchQuery(String(row[ORGANICO_IDX.NOME] ?? ""), q));
    }
    if (filterCargo.length > 0) {
      const set = new Set(filterCargo);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.CARGO)));
    }
    if (filterSetor.length > 0) {
      const set = new Set(filterSetor);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.SETOR)));
    }
    if (filterArea.length > 0) {
      const set = new Set(filterArea);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.AREA)));
    }
    if (filterGestorImediato.length > 0) {
      const set = new Set(filterGestorImediato);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_IMEDIATO)));
    }
    if (filterGestorMediato.length > 0) {
      const set = new Set(filterGestorMediato);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_MEDIATO)));
    }
    if (filterGrauInstrucao.length > 0) {
      const set = new Set(filterGrauInstrucao);
      items = items.filter((row) => set.has(cellStr(row, ORGANICO_IDX.GRAU_INSTRUCAO)));
    }
    const options = new Set<string>();
    for (const row of items) {
      if (getStatusFromRow(row) !== "Desligado") continue;
      const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
      const motivo = String(lookupValueByMatriculaFolha(motivoDemissaoByMatricula, mat) ?? "").trim();
      if (motivo) options.add(motivo);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [
    shouldShowMotivoDemissaoFilter,
    visibleData,
    statusFilter,
    nomeFilter,
    filterCargo,
    filterSetor,
    filterArea,
    filterGestorImediato,
    filterGestorMediato,
    filterGrauInstrucao,
    motivoDemissaoByMatricula,
  ]);

  const filteredData = useMemo(() => {
    type Item = { row: OrganicoSheetRow; originalIndex: number };
    let items: Item[] = visibleData.map((row) => ({ row, originalIndex: data.indexOf(row) }));

    items = items.filter(({ row }) => rowMatchesStatusFilter(row, statusFilter));

    if (nomeFilter.trim()) {
      const q = nomeFilter.trim();
      items = items.filter(({ row }) =>
        textMatchesSearchQuery(String(row[ORGANICO_IDX.NOME] ?? ""), q)
      );
    }

    const cellStr = (row: OrganicoSheetRow, i: number) => String(row[i] ?? "").trim();

    if (filterCargo.length > 0) {
      const set = new Set(filterCargo);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.CARGO)));
    }
    if (filterSetor.length > 0) {
      const set = new Set(filterSetor);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.SETOR)));
    }
    if (filterArea.length > 0) {
      const set = new Set(filterArea);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.AREA)));
    }
    if (filterGestorImediato.length > 0) {
      const set = new Set(filterGestorImediato);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_IMEDIATO)));
    }
    if (filterGestorMediato.length > 0) {
      const set = new Set(filterGestorMediato);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.GESTOR_MEDIATO)));
    }
    if (filterGrauInstrucao.length > 0) {
      const set = new Set(filterGrauInstrucao);
      items = items.filter(({ row }) => set.has(cellStr(row, ORGANICO_IDX.GRAU_INSTRUCAO)));
    }
    if (filterMotivoDemissao.length > 0) {
      const set = new Set(filterMotivoDemissao);
      items = items.filter(({ row }) => {
        if (getStatusFromRow(row) !== "Desligado") return false;
        const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
        const motivo = String(lookupValueByMatriculaFolha(motivoDemissaoByMatricula, mat) ?? "").trim();
        return motivo ? set.has(motivo) : false;
      });
    }

    const demissaoFor = (row: OrganicoSheetRow) =>
      demissaoByMatricula[String(row[ORGANICO_IDX.MATRICULA] ?? "").trim()];

    if (sortTempoEmpresa === "tempo_desc") {
      items = [...items].sort((a, b) => {
        const ma = getTempoEmpresaMeses(a.row, demissaoFor(a.row));
        const mb = getTempoEmpresaMeses(b.row, demissaoFor(b.row));
        const aOk = ma >= 0;
        const bOk = mb >= 0;
        if (!aOk && !bOk) return 0;
        if (!aOk) return 1;
        if (!bOk) return -1;
        return mb - ma;
      });
    } else if (sortTempoEmpresa === "tempo_asc") {
      items = [...items].sort((a, b) => {
        const ma = getTempoEmpresaMeses(a.row, demissaoFor(a.row));
        const mb = getTempoEmpresaMeses(b.row, demissaoFor(b.row));
        const aOk = ma >= 0;
        const bOk = mb >= 0;
        if (!aOk && !bOk) return 0;
        if (!aOk) return 1;
        if (!bOk) return -1;
        return ma - mb;
      });
    }

    if (sortNome === "nome_asc") {
      items = [...items].sort((a, b) =>
        cellStr(a.row, ORGANICO_IDX.NOME).localeCompare(cellStr(b.row, ORGANICO_IDX.NOME), "pt-BR")
      );
    } else if (sortNome === "nome_desc") {
      items = [...items].sort((a, b) =>
        cellStr(b.row, ORGANICO_IDX.NOME).localeCompare(cellStr(a.row, ORGANICO_IDX.NOME), "pt-BR")
      );
    }

    return items;
  }, [
    data,
    visibleData,
    statusFilter,
    nomeFilter,
    sortNome,
    filterCargo,
    filterSetor,
    filterArea,
    filterGestorImediato,
    filterGestorMediato,
    filterGrauInstrucao,
    filterMotivoDemissao,
    sortTempoEmpresa,
    demissaoByMatricula,
    motivoDemissaoByMatricula,
  ]);

  const representantesInFuncionarios = useMemo(() => {
    if (!shouldShowRepresentantesInFuncionarios) return [];
    if (statusFilter.length > 0 && !statusFilter.includes("Ativos")) return [];
    if (filterGestorImediato.length > 0 || filterGestorMediato.length > 0) return [];

    let items = (representantesData ?? []).map((representante) => {
      const key = representanteKeyOf(representante);
      const draft = representanteDraftsByKey[key] ?? { ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT };
      return { representante, key, draft };
    });

    if (nomeFilter.trim()) {
      const q = nomeFilter.trim();
      items = items.filter(({ representante }) =>
        textMatchesSearchQuery(representante.nome, q)
        || textMatchesSearchQuery(representante.nomeRazaoSocial, q),
      );
    }
    if (filterCargo.length > 0) {
      const set = new Set(filterCargo);
      items = items.filter(({ draft }) => set.has(String(draft.cargo ?? "").trim()));
    }
    if (filterArea.length > 0) {
      const set = new Set(filterArea);
      items = items.filter(({ draft }) => set.has(String(draft.area ?? "").trim()));
    }
    if (filterGrauInstrucao.length > 0) {
      const set = new Set(filterGrauInstrucao);
      items = items.filter(({ draft }) => set.has(String(draft.grauInstrucao ?? "").trim()));
    }

    if (sortNome === "nome_asc") {
      items = [...items].sort((a, b) => a.representante.nome.localeCompare(b.representante.nome, "pt-BR"));
    } else if (sortNome === "nome_desc") {
      items = [...items].sort((a, b) => b.representante.nome.localeCompare(a.representante.nome, "pt-BR"));
    }

    return items;
  }, [
    shouldShowRepresentantesInFuncionarios,
    statusFilter,
    filterGestorImediato,
    filterGestorMediato,
    representantesData,
    representanteDraftsByKey,
    nomeFilter,
    filterCargo,
    filterArea,
    filterGrauInstrucao,
    sortNome,
  ]);

  const filterContextBase = useMemo(
    () => ({
      statusFilter,
      nomeFilter,
      filterCargo,
      filterSetor,
      filterArea,
      filterGestorImediato,
      filterGestorMediato,
      filterGrauInstrucao,
    }),
    [
      statusFilter,
      nomeFilter,
      filterCargo,
      filterSetor,
      filterArea,
      filterGestorImediato,
      filterGestorMediato,
      filterGrauInstrucao,
    ],
  );

  const optionRows = useMemo(
    () => applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: null }),
    [visibleData, filterContextBase],
  );

  const filterOptions = useMemo(
    () => ({
      cargos: uniqueOptionsFromRows(
        applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "cargo" }),
        ORGANICO_IDX.CARGO,
      ),
      setores: appendUniqueOption(
        uniqueOptionsFromRows(
          applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "setor" }),
          ORGANICO_IDX.SETOR,
        ),
        ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
      ),
      areas: uniqueOptionsFromRows(
        applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "area" }),
        ORGANICO_IDX.AREA,
      ),
      gestoresImediatos: uniqueOptionsFromRows(
        applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "gestorImediato" }),
        ORGANICO_IDX.GESTOR_IMEDIATO,
      ),
      gestoresMediatos: uniqueOptionsFromRows(
        applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "gestorMediato" }),
        ORGANICO_IDX.GESTOR_MEDIATO,
      ),
      grausInstrucao: uniqueOptionsFromRows(
        applyOrganicoFilterContext(visibleData, { ...filterContextBase, exclude: "grauInstrucao" }),
        ORGANICO_IDX.GRAU_INSTRUCAO,
      ),
    }),
    [visibleData, filterContextBase],
  );

  useEffect(() => {
    // Só valida após o orgânico carregar — antes disso `setores` tem só o placeholder e apagava filtros restaurados.
    if (data.length === 0) return;

    setFilterCargo((prev) => pruneSelectedFilterValues(prev, filterOptions.cargos));
    setFilterSetor((prev) => pruneSelectedFilterValues(prev, filterOptions.setores));
    setFilterArea((prev) => pruneSelectedFilterValues(prev, filterOptions.areas));
    setFilterGestorImediato((prev) => pruneSelectedFilterValues(prev, filterOptions.gestoresImediatos));
    setFilterGestorMediato((prev) => pruneSelectedFilterValues(prev, filterOptions.gestoresMediatos));
    setFilterGrauInstrucao((prev) => pruneSelectedFilterValues(prev, filterOptions.grausInstrucao));
  }, [filterOptions, data.length]);

  const nomesOptions = useMemo(() => {
    const list = uniqueOptionsFromRows(optionRows, ORGANICO_IDX.NOME);
    if (sortNome === "nome_desc") return [...list].sort((a, b) => b.localeCompare(a, "pt-BR"));
    return [...list].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [optionRows, sortNome]);

  const nomesOptionsFiltrados = useMemo(() => {
    const q = nomeFilter.trim();
    if (!q) return nomesOptions;
    return nomesOptions.filter((nome) => textMatchesSearchQuery(nome, q));
  }, [nomesOptions, nomeFilter]);

  useEffect(() => {
    const onClickOutside = (ev: MouseEvent) => {
      if (!nomeFilterWrapRef.current) return;
      const target = ev.target as Node | null;
      if (target && !nomeFilterWrapRef.current.contains(target)) {
        setNomeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusMatricula = (params.get("focusMatricula") ?? "").trim();
    if (!focusMatricula) return;

    setStatusFilter([]);
    setNomeFilter("");
    setHighlightMatricula(focusMatricula);

    let tries = 0;
    const maxTries = 20;
    const interval = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-matricula="${focusMatricula}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.clearInterval(interval);
      } else if (tries >= maxTries) {
        window.clearInterval(interval);
      }
      tries += 1;
    }, 120);

    const clearHighlight = window.setTimeout(() => setHighlightMatricula(""), 2600);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(clearHighlight);
    };
  }, [location.search]);

  const handleEditRow = useCallback((rowIndex: number) => {
    setModalMode(canEditOrganico ? "edit" : "view");
    setEditingRowIndex(rowIndex);
    setFormModalOpen(true);
  }, [canEditOrganico]);

  const handleViewRow = useCallback((rowIndex: number) => {
    setModalMode("view");
    setEditingRowIndex(rowIndex);
    setFormModalOpen(true);
  }, []);

  const handleFormSave = useCallback(async ({ row, activityLogs }: FormFuncionarioModalSavePayload) => {
    if (!canEditOrganico) return;
    const arr = Array.isArray(row) ? [...row] : [];
    while (arr.length < ORGANICO_NUM_COLUNAS) arr.push("");
    calcularFormulasRow(arr, { demissaoByMatricula });
    if (editingRowIndex != null) {
      const previousRow = data[editingRowIndex] ?? null;
      const matricula = String(arr[ORGANICO_IDX.MATRICULA] ?? previousRow?.[ORGANICO_IDX.MATRICULA] ?? "").trim();
      const nome = String(arr[ORGANICO_IDX.NOME] ?? previousRow?.[ORGANICO_IDX.NOME] ?? "").trim();
      const currentUser = getCurrentUser()?.trim() || "Usuário";
      const nextRows = [...data];
      nextRows[editingRowIndex] = arr;

      setData(nextRows);
      try {
        await runWithSaving(async () => {
          await replaceOrganico(nextRows.map((rowItem) => rowToReplaceRow(rowItem)));
          await queryClient.invalidateQueries({ queryKey: ["organico"] });
        }, "Salvando colaborador…");
      } catch (error) {
        if (previousRow) {
          setData((prev) => {
            const rollback = [...prev];
            rollback[editingRowIndex] = previousRow;
            return rollback;
          });
        }
        toast({
          title: "Erro ao salvar alterações",
          description:
            error instanceof Error
              ? error.message
              : "As alterações não puderam ser gravadas no banco.",
          variant: "destructive",
        });
        return;
      }

      if (activityLogs.length > 0 && nome) {
        try {
          await addOrganicoAtividades({
            matricula,
            colaboradorNome: nome,
            createdBy: currentUser,
            entries: activityLogs,
          });
          await queryClient.invalidateQueries({ queryKey: ["organico-comentarios"] });
          await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
        } catch (error) {
          toast({
            title: "Alterações salvas com aviso",
            description:
              error instanceof Error
                ? `Os dados foram atualizados, mas os logs não puderam ser gravados: ${error.message}`
                : "Os dados foram atualizados, mas os logs não puderam ser gravados.",
            variant: "destructive",
          });
          setFormModalOpen(false);
          setEditingRowIndex(null);
          return;
        }
      }

      toast({
        title: "Alterações salvas",
        description:
          activityLogs.length > 0
            ? `${activityLogs.length} log(s) automático(s) foram registrados.`
            : "Os dados foram atualizados.",
      });
    }
    setFormModalOpen(false);
    setEditingRowIndex(null);
  }, [canEditOrganico, data, demissaoByMatricula, editingRowIndex, queryClient, toast]);

  const handleImportClick = () => {
    if (!canEditOrganico) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEditOrganico) return;
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
        toast({ title: "Arquivo inválido", description: "Selecione um arquivo Excel (.xlsx ou .xls).", variant: "destructive" });
        e.target.value = "";
        return;
      }

      setImportPreviewFileName(file.name);
      setImportValidation(null);
      setImportPreviewOpen(true);

      parseFile(file)
        .then(({ rows, columnMapWarnings }) => {
          const isPartialExport =
            filteredData.length < data.length ||
            activeFiltersCount > 0 ||
            sortNome !== "padrao" ||
            sortTempoEmpresa !== "padrao";

          const validation = validateOrganicoImport({
            baseRows: data,
            importedRows: rows,
            columnMapWarnings,
            secullumMatriculaSet,
            demissaoByMatricula,
            isPartialExport,
          });
          setImportValidation(validation);

          if (validation.errors.length > 0) {
            setImportPreviewOpen(true);
          }
        })
        .catch((err) => {
          setImportPreviewOpen(false);
          setImportValidation(null);
          toast({
            title: "Erro na importação",
            description: err instanceof Error ? err.message : "Não foi possível ler o arquivo.",
            variant: "destructive",
          });
        });
      e.target.value = "";
    },
    [
      canEditOrganico,
      parseFile,
      toast,
      data,
      filteredData.length,
      activeFiltersCount,
      sortNome,
      sortTempoEmpresa,
      secullumMatriculaSet,
      demissaoByMatricula,
    ],
  );

  const handleImportConfirm = useCallback(
    async ({ generateActivityLogs }: { generateActivityLogs: boolean }) => {
    if (!canEditOrganico || !importValidation?.canImport) return;

    setImportConfirmPhase("progress");
    const { proposedRows, changeLog } = importValidation;

    try {
      setData(proposedRows);
      await runWithSaving(async () => {
        await replaceOrganico(proposedRows.map((row) => rowToReplaceRow(row)));
        await queryClient.invalidateQueries({ queryKey: ["organico"] });
      }, "Importando orgânico…");

      let logsSaved = 0;
      let logsFailed = false;

      if (generateActivityLogs && changeLog.length > 0) {
        const currentUser = getCurrentUser()?.trim() || "Usuário";
        const grouped = groupChangeLogByMatricula(changeLog);

        for (const [, entries] of grouped) {
          if (entries.length === 0) continue;
          const first = entries[0]!;
          const activityEntries = entries.map(changeLogEntryToActivityDraft);
          try {
            await addOrganicoAtividades({
              matricula: first.matricula,
              colaboradorNome: first.colaboradorNome,
              createdBy: currentUser,
              entries: activityEntries,
            });
            logsSaved += activityEntries.length;
          } catch {
            logsFailed = true;
          }
        }

        if (logsSaved > 0) {
          await queryClient.invalidateQueries({ queryKey: ["organico-comentarios"] });
          await queryClient.invalidateQueries({ queryKey: ["organico-comentarios-resumo"] });
        }
      }

      setImportConfirmPhase("success");
      await new Promise((resolve) => setTimeout(resolve, 1400));

      setImportPreviewOpen(false);
      setImportValidation(null);
      setImportConfirmPhase("idle");

      const changed = importValidation.stats.collaboratorsChanged;
      let description: string;
      if (!generateActivityLogs) {
        description = `${changed} colaborador(es) atualizado(s). Importação de correção — nenhum log de comentários ou trajetória foi gerado.`;
      } else if (logsFailed) {
        description = `${changeLog.length} alteração(ões) aplicada(s). Alguns logs não puderam ser gravados.`;
      } else {
        description = `${changed} colaborador(es) atualizado(s), ${changeLog.length} log(s) registrado(s).`;
      }

      toast({
        title: "Importação concluída",
        description,
        variant: logsFailed ? "destructive" : "default",
      });
    } catch (err) {
      setImportConfirmPhase("error");
      toast({
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Não foi possível gravar no banco.",
        variant: "destructive",
      });
      setImportConfirmPhase("idle");
    }
  },
    [canEditOrganico, importValidation, queryClient, toast],
  );

  const handleSyncSecullum = useCallback(async () => {
    if (!canEditOrganico) return;
    if (!isApiConfigured()) {
      toast({
        title: "API não configurada",
        description: "Defina VITE_API_URL no .env para usar a sincronização Secullum.",
        variant: "destructive",
      });
      return;
    }
    setSyncSecullumLoading(true);
    try {
      const funcionarios = await getSecullumFuncionarios();
      const result = await applySecullumSync(funcionarios, { actor: "API Secullum" });
      await queryClient.invalidateQueries({ queryKey: ["secullum-empresa-by-matricula"] });
      toast({
        title: "Sincronização Secullum concluída",
        description:
          result.removedRows > 0
            ? `${funcionarios.length} colaborador(es). ${result.removedRows} registro(s) removido(s) por não existir(em) mais na API.`
            : result.logCount > 0
              ? `${funcionarios.length} colaborador(es). ${result.logCount} log(s) automático(s) registrados pela API Secullum.`
              : `${funcionarios.length} colaborador(es). Novos cadastros na Secullum aparecem automaticamente.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao sincronizar Secullum",
        description: err instanceof Error ? err.message : "Verifique a configuração da API.",
        variant: "destructive",
      });
    } finally {
      setSyncSecullumLoading(false);
    }
  }, [canEditOrganico, applySecullumSync, toast, queryClient]);

  const handleExport = useCallback(async () => {
    if (!showingFuncionarios) {
      toast({
        title: "Exportação indisponível",
        description: "Mude para a subguia Funcionários para exportar os dados da tela.",
        variant: "destructive",
      });
      return;
    }
    if (filteredData.length === 0) {
      toast({ title: "Nada para exportar", description: "Não há dados para exportar.", variant: "destructive" });
      return;
    }

    const rowsPrepared = filteredData.map(({ row }) => {
      const copy = Array.isArray(row) ? [...row] : [];
      while (copy.length < ORGANICO_NUM_COLUNAS) copy.push("");
      calcularFormulasRow(copy, { demissaoByMatricula });
      return copy as OrganicoSheetRow;
    });
    const rowsSorted = sortRowsByMatricula(rowsPrepared);
    const recorteFiltrado =
      filteredData.length < data.length ||
      activeFiltersCount > 0 ||
      sortNome !== "padrao" ||
      sortTempoEmpresa !== "padrao";
    const exportMeta = buildExportMeta(rowsSorted, data.length, recorteFiltrado, selectedEmpresaTab);

    try {
      await exportToExcel(rowsSorted, "organico.xlsx", exportMeta);
      toast({
        title: "Exportação concluída",
        description: recorteFiltrado
          ? `Arquivo com ${rowsSorted.length} linha(s) (recorte filtrado). Ordem estável por matrícula.`
          : `Arquivo com ${rowsSorted.length} linha(s), ordenado por matrícula.`,
      });
    } catch {
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    }
  }, [
    showingFuncionarios,
    filteredData,
    data.length,
    activeFiltersCount,
    sortNome,
    sortTempoEmpresa,
    demissaoByMatricula,
    exportToExcel,
    toast,
    selectedEmpresaTab,
  ]);

  return (
    <AppLayout>
      <div className="p-6 flex flex-col min-h-[calc(100vh-4rem)] bg-background">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Orgânico</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            {canEditOrganico ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncSecullum}
                disabled={syncSecullumLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${syncSecullumLoading ? "animate-spin" : ""}`} />
                {syncSecullumLoading ? "Sincronizando..." : "Sincronizar Secullum"}
              </Button>
            ) : null}
            {canEditOrganico ? (
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="w-4 h-4 mr-1" /> Importar Excel
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Exportar Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <LayoutTemplate className="w-4 h-4" />
                  Visualizar
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Layout dos cards
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={cardViewMode}
                  onValueChange={(v) => setCardViewMode(v as OrganicoCardViewMode)}
                >
                  {ORGANICO_CARD_VIEW_OPTIONS.map(({ value, label }) => {
                    const Icon = VIEW_MODE_ICONS[value];
                    return (
                      <DropdownMenuRadioItem key={value} value={value} className="pl-8">
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                          {label}
                        </span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {canJustificarSecullum ? (
          <>
            <OrganicoSecullumPendenciasBanner
              count={pendenciasFiltradasSetor.length}
              onOpen={() => setPendenciasDialogOpen(true)}
            />
            <OrganicoSecullumPendenciasDialog
              open={pendenciasDialogOpen}
              onOpenChange={setPendenciasDialogOpen}
              items={pendenciasFiltradasSetor}
              busyId={pendenciaBusyId}
              pendingAction={pendenciaPendingAction}
              masterCanDismiss={isMaster()}
              onResolve={async (id, motivo) => {
                await resolvePendenciaMutation.mutateAsync({ id, motivo });
              }}
              onDismiss={async (id) => {
                await dismissPendenciaMutation.mutateAsync({ id });
              }}
            />
          </>
        ) : null}

        <div className="mb-2 flex items-end gap-2 overflow-x-auto border-b border-border pb-0">
          {empresaTabs.map((empresa) => {
            const isActive = selectedEmpresaTab === empresa;
            return (
              <button
                key={empresa}
                type="button"
                onClick={() => handleSelectEmpresaTab(empresa)}
                className={cn(
                  "relative -mb-px whitespace-nowrap rounded-t-md border border-b px-4 py-2 text-xs font-bold tracking-wide transition-colors",
                  isActive
                    ? "border-border border-b-background bg-background text-primary shadow-[inset_0_1px_0_hsl(var(--background))]"
                    : "border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/55 hover:text-foreground",
                )}
                aria-pressed={isActive}
              >
                {empresa}
              </button>
            );
          })}
        </div>

        {isSoAcoTabActive && (
          <div className="mb-3 flex items-end gap-2 overflow-x-auto border-b border-border/80 pb-0">
            {ORGANICO_SO_ACO_SUBTABS.map((subTab) => {
              const isActive = selectedSoAcoSubTab === subTab;
              return (
                <button
                  key={subTab}
                  type="button"
                  onClick={() => handleSelectSoAcoSubTab(subTab)}
                  className={cn(
                    "relative -mb-px whitespace-nowrap rounded-t-md border border-b px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors",
                    isActive
                      ? "border-border border-b-background bg-background text-primary"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  aria-pressed={isActive}
                >
                  {subTab}
                </button>
              );
            })}
          </div>
        )}

        {showingFuncionarios && (
        <div className="mb-5 border border-border rounded-lg bg-muted/30 overflow-visible">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setFiltersVisible((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFiltersVisible((v) => !v);
              }
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-expanded={filtersVisible}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({activeFiltersCount} ativo(s))</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustoTotal((v) => !v);
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] font-semibold transition-colors",
                  showCustoTotal
                    ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
                title={showCustoTotal ? "Ocultar custo total (mês)" : "Exibir custo total (mês)"}
                aria-label={showCustoTotal ? "Ocultar custo total (mês)" : "Exibir custo total (mês)"}
              >
                {showCustoTotal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {activeFiltersCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearOrganicoFilters();
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null}
              {filtersVisible ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </span>
          </div>

          {filtersVisible && (
            <div className="border-t border-border p-4 sm:p-5">
              <div className="flex flex-col gap-5">
                {/* Buscar por colaborador (lista suspensa pesquisável + ordenação) */}
                <div className="w-full min-w-0">
                  <div className="min-w-0" ref={nomeFilterWrapRef}>
                    <label
                      htmlFor="organico-filtro-nome"
                      className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1"
                    >
                      Buscar colaborador
                    </label>
                    <div className="relative w-full">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-[1]"
                        aria-hidden
                      />
                      <input
                        id="organico-filtro-nome"
                        type="search"
                        placeholder="Digite ou selecione um colaborador..."
                        value={nomeFilter}
                        onChange={(e) => {
                          setNomeFilter(e.target.value);
                          setNomeDropdownOpen(true);
                        }}
                        onFocus={() => setNomeDropdownOpen(true)}
                        className="w-full h-9 pl-9 pr-9 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 rounded-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setNomeDropdownOpen((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground"
                        aria-label="Abrir lista de colaboradores"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {nomeDropdownOpen && (
                        <div className="absolute z-40 top-full mt-1 w-full border border-border bg-popover shadow-md rounded-sm overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                              Ordenar nomes
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setSortNome("nome_asc")}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold rounded-sm border",
                                  sortNome === "nome_asc"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border"
                                )}
                              >
                                ASC
                              </button>
                              <button
                                type="button"
                                onClick={() => setSortNome("nome_desc")}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold rounded-sm border",
                                  sortNome === "nome_desc"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border"
                                )}
                              >
                                DESC
                              </button>
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto py-1">
                            {nomesOptionsFiltrados.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
                            ) : (
                              nomesOptionsFiltrados.map((nome) => (
                                <button
                                  key={nome}
                                  type="button"
                                  onClick={() => {
                                    setNomeFilter(nome);
                                    setNomeDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                                >
                                  {nome}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grade uniforme: 2 linhas x 4 colunas */}
                <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Tempo de empresa
                    </label>
                    <select
                      value={sortTempoEmpresa}
                      onChange={(e) => setSortTempoEmpresa(e.target.value as "padrao" | "tempo_desc" | "tempo_asc")}
                      className="h-9 w-full min-w-0 px-3 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 rounded-sm"
                    >
                      <option value="padrao">Ordem padrão</option>
                      <option value="tempo_desc">Maior → menor</option>
                      <option value="tempo_asc">Menor → maior</option>
                    </select>
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Cargo
                    </label>
                    <MultiSelectFilter options={filterOptions.cargos} selected={filterCargo} onChange={setFilterCargo} />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Setor
                    </label>
                    <MultiSelectFilter
                      options={filterOptions.setores}
                      selected={filterSetor}
                      onChange={setFilterSetor}
                      optionDescriptions={ORGANICO_SETOR_OPTION_DESCRIPTIONS}
                    />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Área
                    </label>
                    <MultiSelectFilter options={filterOptions.areas} selected={filterArea} onChange={setFilterArea} />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Gestor imediato
                    </label>
                    <MultiSelectFilter
                      options={filterOptions.gestoresImediatos}
                      selected={filterGestorImediato}
                      onChange={setFilterGestorImediato}
                    />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Gestor mediato
                    </label>
                    <MultiSelectFilter
                      options={filterOptions.gestoresMediatos}
                      selected={filterGestorMediato}
                      onChange={setFilterGestorMediato}
                    />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Grau de instrução
                    </label>
                    <MultiSelectFilter
                      options={filterOptions.grausInstrucao}
                      selected={filterGrauInstrucao}
                      onChange={setFilterGrauInstrucao}
                    />
                  </div>

                  <div className="min-w-0 flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                      Status
                    </label>
                    <MultiSelectFilter
                      options={[...STATUS_FILTER_OPTIONS]}
                      selected={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </div>

                  {shouldShowMotivoDemissaoFilter && (
                    <div className="min-w-0 flex flex-col">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">
                        Motivo de desligamento (Secullum)
                      </label>
                      <MultiSelectFilter
                        options={motivoDemissaoFilterOptions}
                        selected={filterMotivoDemissao}
                        onChange={setFilterMotivoDemissao}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {showingFuncionarios && !loadingOrganico && !errorOrganico ? (
          <div className="mb-3 text-xs text-muted-foreground">
            {representantesInFuncionarios.length > 0
              ? `${filteredData.length + representantesInFuncionarios.length} registro(s) (${representantesInFuncionarios.length} externo(s))`
              : filteredData.length === data.length
                ? `${data.length} registro(s)`
                : `${filteredData.length} de ${data.length} registro(s)`}
          </div>
        ) : null}

        {showingFuncionarios && loadingOrganico && (
          <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground text-sm">
            Carregando dados...
          </div>
        )}

        {showingFuncionarios && errorOrganico && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-destructive font-medium">Erro ao carregar dados do banco.</p>
            <Button variant="outline" size="sm" onClick={() => refetchOrganico()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {showingFuncionarios && !loadingOrganico && !errorOrganico && (
          <>
            {filteredData.length === 0 && representantesInFuncionarios.length === 0 && !loadingRepresentantes ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  {data.length === 0
                    ? "Nenhum funcionário. Sincronize a Secullum ou importe um Excel para carregar os dados."
                    : "Nenhum registro corresponde à busca ou filtros."}
                </p>
              </div>
            ) : (
              <div className={cn(organicoListContainerClass(cardViewMode), "overflow-y-auto")}>
                {filteredData.map(({ row, originalIndex }) => (
                  <div
                    key={originalIndex}
                    data-matricula={String(row[ORGANICO_IDX.MATRICULA] ?? "").trim()}
                    className={cn(
                      "rounded-lg transition-all duration-500",
                      highlightMatricula &&
                        String(row[ORGANICO_IDX.MATRICULA] ?? "").trim() === highlightMatricula &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                  >
                    <OrganicoCard
                      row={row}
                      rowIndex={originalIndex}
                      viewMode={cardViewMode}
                      pendenciaSecullum={
                        canJustificarSecullum &&
                        matriculasComPendenciaSecullum.has(String(row[ORGANICO_IDX.MATRICULA] ?? "").trim())
                      }
                      fotoCadastrada={matriculasComFoto.has(String(row[ORGANICO_IDX.MATRICULA] ?? "").trim())}
                      fotoApiHabilitada={canViewPhotos && isApiConfigured()}
                      showCustoTotal={isCustoVisibleFor(String(row[ORGANICO_IDX.MATRICULA] ?? "").trim())}
                      onToggleCustoTotal={() => {
                        const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
                        if (!mat) return;
                        toggleCustoVisibilityFor(mat);
                      }}
                      custoRevealed={isCustoVisibleFor(String(row[ORGANICO_IDX.MATRICULA] ?? "").trim())}
                      demissao={lookupValueByMatriculaFolha(demissaoByMatricula, String(row[ORGANICO_IDX.MATRICULA] ?? ""))}
                      hasComments={comentarioKeySet.has(
                        buildComentarioKey(
                          String(row[ORGANICO_IDX.MATRICULA] ?? "").trim(),
                          String(row[ORGANICO_IDX.NOME] ?? "").trim()
                        )
                      )}
                      onView={handleViewRow}
                      onEdit={handleEditRow}
                      readOnly={!canEditOrganico}
                    />
                  </div>
                ))}
                {shouldShowRepresentantesInFuncionarios && loadingRepresentantes ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Carregando representantes externos...
                  </div>
                ) : null}
                {representantesInFuncionarios.map(({ representante, key, draft }) => (
                  <div key={`representante-${key}`} className="rounded-lg transition-all duration-500">
                    <OrganicoRepresentanteCard
                      nome={representante.nome}
                      nomeRazaoSocial={representante.nomeRazaoSocial}
                      draft={draft}
                      onEdit={() => {
                        if (!key) return;
                        setRepresentanteModalMode(canEditOrganico ? "edit" : "view");
                        setEditingRepresentanteKey(key);
                        setEditingRepresentanteNome(representante.nome);
                        setEditingRepresentanteRazaoSocial(representante.nomeRazaoSocial);
                        setRepresentanteModalOpen(true);
                      }}
                      onView={() => {
                        if (!key) return;
                        setRepresentanteModalMode("view");
                        setEditingRepresentanteKey(key);
                        setEditingRepresentanteNome(representante.nome);
                        setEditingRepresentanteRazaoSocial(representante.nomeRazaoSocial);
                        setRepresentanteModalOpen(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showingRepresentantes && loadingRepresentantes && (
          <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground text-sm">
            Carregando representantes...
          </div>
        )}

        {showingRepresentantes && errorRepresentantes && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <p className="text-destructive font-medium">Erro ao carregar representantes.</p>
            {representantesError instanceof Error && representantesError.message.trim() ? (
              <p className="text-sm text-muted-foreground max-w-lg">{representantesError.message}</p>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => refetchRepresentantes()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {showingRepresentantes && !loadingRepresentantes && !errorRepresentantes && (
          <>
            {(representantesData ?? []).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  Nenhum representante ativo encontrado na integração.
                </p>
              </div>
            ) : (
              <div className={cn(organicoListContainerClass(cardViewMode), "overflow-y-auto")}>
                {(representantesData ?? []).map((representante) => {
                  const repKey = representanteKeyOf(representante);
                  return (
                  <OrganicoRepresentanteCard
                    key={repKey}
                    nome={representante.nome}
                    nomeRazaoSocial={representante.nomeRazaoSocial}
                    draft={
                      representanteDraftsByKey[repKey]
                      ?? { ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT }
                    }
                    onEdit={() => {
                      if (!repKey) return;
                      setRepresentanteModalMode(canEditOrganico ? "edit" : "view");
                      setEditingRepresentanteKey(repKey);
                      setEditingRepresentanteNome(representante.nome);
                      setEditingRepresentanteRazaoSocial(representante.nomeRazaoSocial);
                      setRepresentanteModalOpen(true);
                    }}
                    onView={() => {
                      if (!repKey) return;
                      setRepresentanteModalMode("view");
                      setEditingRepresentanteKey(repKey);
                      setEditingRepresentanteNome(representante.nome);
                      setEditingRepresentanteRazaoSocial(representante.nomeRazaoSocial);
                      setRepresentanteModalOpen(true);
                    }}
                  />
                  );
                })}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground shrink-0">
              {(representantesData ?? []).length} representante(s)
            </div>
          </>
        )}

        <OrganicoImportPreviewDialog
          open={importPreviewOpen}
          onOpenChange={(open) => {
            if (!open && importConfirmPhase !== "idle" && importConfirmPhase !== "error") return;
            setImportPreviewOpen(open);
            if (!open) {
              setImportValidation(null);
              setImportConfirmPhase("idle");
            }
          }}
          fileName={importPreviewFileName}
          validation={importValidation}
          confirmPhase={importConfirmPhase}
          onConfirm={handleImportConfirm}
        />

        <FormFuncionarioModal
          open={formModalOpen}
          onOpenChange={(open) => {
            setFormModalOpen(open);
            if (!open) {
              setEditingRowIndex(null);
              setModalMode("edit");
            }
          }}
          initialRow={editingRowIndex != null ? data[editingRowIndex] ?? null : null}
          onSave={handleFormSave}
          readOnly={
            modalMode === "view" ||
            !canEditOrganico ||
            editableTabIds.length === 0 ||
            editingRowIndex != null &&
            getStatusFromRow(data[editingRowIndex] ?? []) === "Desligado"
          }
          allowedTabIds={allowedTabIds}
          editableTabIds={editableTabIds}
          commentsPermissions={{
            view: canViewComments,
            edit: canCreateComments || canDeleteComments,
          }}
          photoPermissions={{
            view: canViewPhotos,
            edit: canEditPhotos,
          }}
          documentPermissions={masterUser ? undefined : effectiveGroupPermissions?.organico.documentos}
          demissao={
            editingRowIndex != null
              ? lookupValueByMatriculaFolha(demissaoByMatricula, String(data[editingRowIndex]?.[ORGANICO_IDX.MATRICULA] ?? ""))
              : undefined
          }
          motivoDemissao={
            editingRowIndex != null
              ? lookupValueByMatriculaFolha(motivoDemissaoByMatricula, String(data[editingRowIndex]?.[ORGANICO_IDX.MATRICULA] ?? ""))
              : undefined
          }
          secullumFieldsLocked={secullumFieldsLocked}
        />

        <FormRepresentanteModal
          open={representanteModalOpen}
          onOpenChange={(open) => {
            setRepresentanteModalOpen(open);
            if (!open) {
              setEditingRepresentanteKey(null);
              setEditingRepresentanteNome("");
              setEditingRepresentanteRazaoSocial("");
              setRepresentanteModalMode("edit");
            }
          }}
          nome={editingRepresentanteNome}
          nomeRazaoSocial={editingRepresentanteRazaoSocial}
          initialDraft={
            editingRepresentanteKey
              ? (representanteDraftsByKey[editingRepresentanteKey] ?? { ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT })
              : { ...EMPTY_ORGANICO_REPRESENTANTE_DRAFT }
          }
          readOnly={representanteModalMode === "view" || !canEditOrganico}
          onSave={(next) => {
            const key = editingRepresentanteKey;
            if (!key) return;
            setRepresentanteDraftsByKey((prev) => ({
              ...prev,
              [key]: next,
            }));
            void setOrganicoRepresentante({
              representanteKey: key,
              nome: editingRepresentanteNome,
              nomeRazaoSocial: editingRepresentanteRazaoSocial,
              draft: next,
              updatedBy: getCurrentUser()?.trim() || "Usuário",
            })
              .then(() => {
                toast({
                  title: "Representante salvo",
                  description: "Os dados foram gravados no banco.",
                });
              })
              .catch((error) => {
                toast({
                  title: "Erro ao salvar representante",
                  description:
                    error instanceof Error ? error.message : "Não foi possível gravar os dados no banco.",
                  variant: "destructive",
                });
              });
          }}
        />
      </div>
    </AppLayout>
  );
};

export default Organico;
