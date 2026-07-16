import { readPersistedJson, writePersistedJson } from "@rh/lib/ui-filter-persistence";
import type { FaltaRow } from "@rh/types/api";
import type { SancaoDisciplinarRow } from "@rh/types/api";
import type { FaltaColumnFilter } from "@rh/pages/FaltasAtestados/faltas-column-filter";
import type { SancaoColumnFilter } from "@rh/pages/FaltasAtestados/sancoes-column-filter";

export const FALTAS_ATESTADOS_TAB_SESSION_KEY = "rh-faltas-atestados-tab-v1";
export const FALTAS_AUSENCIAS_FILTERS_SESSION_KEY = "rh-faltas-ausencias-filters-v1";
export const FALTAS_SANCOES_FILTERS_SESSION_KEY = "rh-faltas-sancoes-filters-v1";
export const FALTAS_CADASTROS_FILTERS_SESSION_KEY = "rh-faltas-cadastros-filters-v1";

export type FaltasAtestadosTabId = "ausencias" | "regras-alertas" | "sancoes" | "cadastros";

export type FaltasAusenciasFiltersSession = {
  search: string;
  columnFilters: Partial<Record<keyof FaltaRow, FaltaColumnFilter>>;
  selectedMonths: string[];
  sortConfig: { key: keyof FaltaRow; dir: "asc" | "desc" } | null;
};

export type FaltasSancoesFiltersSession = {
  search: string;
  columnFilters: Partial<Record<keyof SancaoDisciplinarRow, SancaoColumnFilter>>;
  selectedMonths: string[];
  sortConfig: { key: keyof SancaoDisciplinarRow; dir: "asc" | "desc" } | null;
};

export type FaltasCadastrosFiltersSession = {
  sp: string;
  st: string;
  sc: string;
  ss: string;
  sdoc: string;
  sg: string;
};

export function readFaltasAtestadosTab(): FaltasAtestadosTabId | null {
  const raw = readPersistedJson<string>(FALTAS_ATESTADOS_TAB_SESSION_KEY);
  if (
    raw === "ausencias"
    || raw === "regras-alertas"
    || raw === "sancoes"
    || raw === "cadastros"
  ) {
    return raw;
  }
  return null;
}

export function writeFaltasAtestadosTab(tab: FaltasAtestadosTabId): void {
  writePersistedJson(FALTAS_ATESTADOS_TAB_SESSION_KEY, tab);
}

export function readFaltasAusenciasFilters(): Partial<FaltasAusenciasFiltersSession> {
  return readPersistedJson<FaltasAusenciasFiltersSession>(FALTAS_AUSENCIAS_FILTERS_SESSION_KEY) ?? {};
}

export function writeFaltasAusenciasFilters(snapshot: FaltasAusenciasFiltersSession): void {
  writePersistedJson(FALTAS_AUSENCIAS_FILTERS_SESSION_KEY, snapshot);
}

export function readFaltasSancoesFilters(): Partial<FaltasSancoesFiltersSession> {
  return readPersistedJson<FaltasSancoesFiltersSession>(FALTAS_SANCOES_FILTERS_SESSION_KEY) ?? {};
}

export function writeFaltasSancoesFilters(snapshot: FaltasSancoesFiltersSession): void {
  writePersistedJson(FALTAS_SANCOES_FILTERS_SESSION_KEY, snapshot);
}

export function readFaltasCadastrosFilters(): Partial<FaltasCadastrosFiltersSession> {
  return readPersistedJson<FaltasCadastrosFiltersSession>(FALTAS_CADASTROS_FILTERS_SESSION_KEY) ?? {};
}

export function writeFaltasCadastrosFilters(snapshot: FaltasCadastrosFiltersSession): void {
  writePersistedJson(FALTAS_CADASTROS_FILTERS_SESSION_KEY, snapshot);
}
