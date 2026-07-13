import { readPersistedJson, writePersistedJson } from "@rh/lib/ui-filter-persistence";

export const ORGANICO_FILTERS_SESSION_KEY = "rh-organico-filters-v1";

const ORGANICO_EMPRESA_PADRAO = "SÓ AÇO INDUSTRIAL LTDA";
const ORGANICO_SO_ACO_SUBTAB_DEFAULT = "Funcionários" as const;

export type OrganicoSoAcoSubTab = "Funcionários" | "Representantes";

/** Filtros de uma aba (empresa ou empresa + sub-aba Só Aço). */
export type OrganicoFilterScopeState = {
  statusFilter: string[];
  nomeFilter: string;
  sortNome: "padrao" | "nome_asc" | "nome_desc";
  filterCargo: string[];
  filterSetor: string[];
  filterArea: string[];
  filterGestorImediato: string[];
  filterGestorMediato: string[];
  filterGrauInstrucao: string[];
  filterMotivoDemissao: string[];
  sortTempoEmpresa: "padrao" | "tempo_desc" | "tempo_asc";
};

/** Formato legado (filtros globais únicos). */
export type OrganicoFiltersSession = OrganicoFilterScopeState & {
  selectedEmpresaTab: string;
  selectedSoAcoSubTab: OrganicoSoAcoSubTab;
};

export type OrganicoFiltersStoreV2 = {
  v: 2;
  empresaTab: string;
  soAcoSubTab: OrganicoSoAcoSubTab;
  byScope: Record<string, OrganicoFilterScopeState>;
};

const ORGANICO_FILTERS_STORAGE: "local" = "local";

export const ORGANICO_SCOPE_DEFAULTS: OrganicoFilterScopeState = {
  statusFilter: ["Ativos"],
  nomeFilter: "",
  sortNome: "padrao",
  filterCargo: [],
  filterSetor: [],
  filterArea: [],
  filterGestorImediato: [],
  filterGestorMediato: [],
  filterGrauInstrucao: [],
  filterMotivoDemissao: [],
  sortTempoEmpresa: "padrao",
};

/** @deprecated use ORGANICO_SCOPE_DEFAULTS */
export const ORGANICO_FILTERS_DEFAULTS: OrganicoFiltersSession = {
  ...ORGANICO_SCOPE_DEFAULTS,
  selectedEmpresaTab: ORGANICO_EMPRESA_PADRAO,
  selectedSoAcoSubTab: ORGANICO_SO_ACO_SUBTAB_DEFAULT,
};

export function buildOrganicoScopeKey(empresaTab: string, soAcoSubTab: OrganicoSoAcoSubTab): string {
  if (empresaTab === ORGANICO_EMPRESA_PADRAO) {
    return `${empresaTab}::${soAcoSubTab}`;
  }
  return empresaTab;
}

function scopeFromPartial(raw: Partial<OrganicoFilterScopeState> | undefined): OrganicoFilterScopeState {
  return {
    statusFilter: raw?.statusFilter ?? ORGANICO_SCOPE_DEFAULTS.statusFilter,
    nomeFilter: raw?.nomeFilter ?? ORGANICO_SCOPE_DEFAULTS.nomeFilter,
    sortNome: raw?.sortNome ?? ORGANICO_SCOPE_DEFAULTS.sortNome,
    filterCargo: raw?.filterCargo ?? ORGANICO_SCOPE_DEFAULTS.filterCargo,
    filterSetor: raw?.filterSetor ?? ORGANICO_SCOPE_DEFAULTS.filterSetor,
    filterArea: raw?.filterArea ?? ORGANICO_SCOPE_DEFAULTS.filterArea,
    filterGestorImediato: raw?.filterGestorImediato ?? ORGANICO_SCOPE_DEFAULTS.filterGestorImediato,
    filterGestorMediato: raw?.filterGestorMediato ?? ORGANICO_SCOPE_DEFAULTS.filterGestorMediato,
    filterGrauInstrucao: raw?.filterGrauInstrucao ?? ORGANICO_SCOPE_DEFAULTS.filterGrauInstrucao,
    filterMotivoDemissao: raw?.filterMotivoDemissao ?? ORGANICO_SCOPE_DEFAULTS.filterMotivoDemissao,
    sortTempoEmpresa: raw?.sortTempoEmpresa ?? ORGANICO_SCOPE_DEFAULTS.sortTempoEmpresa,
  };
}

function emptyStore(): OrganicoFiltersStoreV2 {
  const empresaTab = ORGANICO_EMPRESA_PADRAO;
  const soAcoSubTab = ORGANICO_SO_ACO_SUBTAB_DEFAULT;
  const key = buildOrganicoScopeKey(empresaTab, soAcoSubTab);
  return {
    v: 2,
    empresaTab,
    soAcoSubTab,
    byScope: { [key]: { ...ORGANICO_SCOPE_DEFAULTS } },
  };
}

function migrateLegacyStore(raw: Partial<OrganicoFiltersSession>): OrganicoFiltersStoreV2 {
  const empresaTab = raw.selectedEmpresaTab ?? ORGANICO_EMPRESA_PADRAO;
  const soAcoSubTab = raw.selectedSoAcoSubTab ?? ORGANICO_SO_ACO_SUBTAB_DEFAULT;
  const key = buildOrganicoScopeKey(empresaTab, soAcoSubTab);
  return {
    v: 2,
    empresaTab,
    soAcoSubTab,
    byScope: { [key]: scopeFromPartial(raw) },
  };
}

export function readOrganicoFiltersStore(): OrganicoFiltersStoreV2 {
  const raw = readPersistedJson<OrganicoFiltersStoreV2 | Partial<OrganicoFiltersSession>>(
    ORGANICO_FILTERS_SESSION_KEY,
    ORGANICO_FILTERS_STORAGE,
  );
  if (!raw || typeof raw !== "object") return emptyStore();
  if ((raw as OrganicoFiltersStoreV2).v === 2) {
    const store = raw as OrganicoFiltersStoreV2;
    return {
      v: 2,
      empresaTab: store.empresaTab ?? ORGANICO_EMPRESA_PADRAO,
      soAcoSubTab: store.soAcoSubTab ?? ORGANICO_SO_ACO_SUBTAB_DEFAULT,
      byScope: store.byScope ?? {},
    };
  }
  return migrateLegacyStore(raw as Partial<OrganicoFiltersSession>);
}

export function writeOrganicoFiltersStore(store: OrganicoFiltersStoreV2): void {
  writePersistedJson(ORGANICO_FILTERS_SESSION_KEY, store, ORGANICO_FILTERS_STORAGE);
}

export function readOrganicoScopeFilters(
  empresaTab: string,
  soAcoSubTab: OrganicoSoAcoSubTab,
): OrganicoFilterScopeState {
  const store = readOrganicoFiltersStore();
  const key = buildOrganicoScopeKey(empresaTab, soAcoSubTab);
  return scopeFromPartial(store.byScope[key]);
}

/** @deprecated use readOrganicoFiltersStore */
export function readOrganicoFilters(): Partial<OrganicoFiltersSession> {
  const store = readOrganicoFiltersStore();
  const key = buildOrganicoScopeKey(store.empresaTab, store.soAcoSubTab);
  return {
    ...scopeFromPartial(store.byScope[key]),
    selectedEmpresaTab: store.empresaTab,
    selectedSoAcoSubTab: store.soAcoSubTab,
  };
}

/** @deprecated use writeOrganicoFiltersStore */
export function writeOrganicoFilters(snapshot: OrganicoFiltersSession): void {
  const store = readOrganicoFiltersStore();
  const key = buildOrganicoScopeKey(snapshot.selectedEmpresaTab, snapshot.selectedSoAcoSubTab);
  store.empresaTab = snapshot.selectedEmpresaTab;
  store.soAcoSubTab = snapshot.selectedSoAcoSubTab;
  store.byScope[key] = scopeFromPartial(snapshot);
  writeOrganicoFiltersStore(store);
}
