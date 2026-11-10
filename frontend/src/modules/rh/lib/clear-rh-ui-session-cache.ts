import { clearPersistedKey } from "@rh/lib/ui-filter-persistence";

/**
 * Chaves de filtros/UI do RH (espelham *-filters-persistence).
 * Devem viver só enquanto a sessão do Gestor estiver ativa.
 */
const RH_UI_SESSION_CACHE_KEYS = [
  "rh-organico-filters-v1",
  "rh-faltas-atestados-tab-v1",
  "rh-faltas-ausencias-filters-v1",
  "rh-faltas-sancoes-filters-v1",
  "rh-faltas-cadastros-filters-v1",
] as const;

/**
 * Descarta caches de filtros do RH (sessionStorage + resíduo legado em localStorage).
 * Chamado no logout e quando a sessão encerra (401 / inatividade).
 */
export function clearRhUiSessionCache(): void {
  for (const key of RH_UI_SESSION_CACHE_KEYS) {
    clearPersistedKey(key, "session");
    clearPersistedKey(key, "local");
  }
}
