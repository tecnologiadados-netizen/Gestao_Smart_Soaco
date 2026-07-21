/**
 * Persiste filtros em sessionStorage para que, ao trocar de tela e voltar,
 * os filtros permaneçam (ex.: Pedidos -> Heatmap -> Pedidos mantém filtro por pedido X).
 */

const KEY_PEDIDOS = 'filtros-pedidos';
const KEY_HEATMAP = 'filtros-heatmap';
const KEY_DASHBOARD = 'filtros-dashboard';

function safeParse<T>(key: string, defaultValue: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return defaultValue;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed != null && typeof parsed === 'object') return parsed as T;
  } catch {
    // ignore
  }
  return defaultValue;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

/** Mescla objeto salvo com defaults para garantir todas as chaves (evita undefined em campos novos). */
function mergeWithDefaults<T extends Record<string, unknown>>(saved: unknown, defaults: T): T {
  if (saved == null || typeof saved !== 'object') return defaults;
  const o = saved as Record<string, unknown>;
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      const v = o[k];
      if (typeof (defaults as Record<string, unknown>)[k] === 'boolean') {
        (out as Record<string, unknown>)[k] = Boolean(v);
      } else {
        (out as Record<string, unknown>)[k] = typeof v === 'string' ? v : String(v ?? '');
      }
    }
  }
  return out;
}

export type FiltrosPedidosState = Record<string, string | boolean | undefined>;

/** Carrega filtros da tela de Pedidos (merge com defaults). */
export function loadFiltrosPedidos(defaults: FiltrosPedidosState): FiltrosPedidosState {
  return mergeWithDefaults(safeParse(KEY_PEDIDOS, null), defaults);
}

/** Salva filtros da tela de Pedidos. */
export function saveFiltrosPedidos(f: FiltrosPedidosState): void {
  try {
    sessionStorage.setItem(KEY_PEDIDOS, safeStringify(f));
  } catch {
    // ignore
  }
}

/** Carrega filtros da tela Heatmap. Se defaults for passado, mescla com o salvo (mesmo formato da faixa de Pedidos). */
export function loadFiltrosHeatmap(defaults?: FiltrosPedidosState): FiltrosPedidosState | Record<string, unknown> {
  if (defaults != null) return mergeWithDefaults(safeParse(KEY_HEATMAP, null), defaults);
  return safeParse<Record<string, unknown>>(KEY_HEATMAP, {});
}

/** Salva filtros da tela Heatmap. */
export function saveFiltrosHeatmap(f: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(KEY_HEATMAP, safeStringify(f));
  } catch {
    // ignore
  }
}

/** Carrega filtros do Dashboard (merge com defaults). */
export function loadFiltrosDashboard(defaults: FiltrosPedidosState): FiltrosPedidosState {
  return mergeWithDefaults(safeParse(KEY_DASHBOARD, null), defaults);
}

/** Salva filtros do Dashboard. */
export function saveFiltrosDashboard(f: FiltrosPedidosState): void {
  try {
    sessionStorage.setItem(KEY_DASHBOARD, safeStringify(f));
  } catch {
    // ignore
  }
}

const KEY_PEDIDOS_GRADE = 'pedidos.gradeFilters.v1';

export type GradeFiltersPersisted = {
  columnFilters: Record<string, string>;
  sortState: { key: string; direction: 'asc' | 'desc' } | null;
};

/** Carrega filtros Excel da grade de Pedidos (sessionStorage). */
export function loadGradeFiltrosPedidos(): GradeFiltersPersisted {
  const saved = safeParse<GradeFiltersPersisted | null>(KEY_PEDIDOS_GRADE, null);
  if (saved == null || typeof saved !== 'object') {
    return { columnFilters: {}, sortState: null };
  }
  const columnFilters =
    saved.columnFilters != null && typeof saved.columnFilters === 'object'
      ? (saved.columnFilters as Record<string, string>)
      : {};
  const sortState =
    saved.sortState != null &&
    typeof saved.sortState === 'object' &&
    typeof (saved.sortState as { key?: unknown }).key === 'string' &&
    ((saved.sortState as { direction?: unknown }).direction === 'asc' ||
      (saved.sortState as { direction?: unknown }).direction === 'desc')
      ? {
          key: (saved.sortState as { key: string }).key,
          direction: (saved.sortState as { direction: 'asc' | 'desc' }).direction,
        }
      : null;
  return { columnFilters, sortState };
}

/** Salva filtros Excel da grade de Pedidos. */
export function saveGradeFiltrosPedidos(data: GradeFiltersPersisted): void {
  try {
    const hasFilters = Object.values(data.columnFilters).some((v) => v?.trim());
    if (!hasFilters && data.sortState == null) {
      sessionStorage.removeItem(KEY_PEDIDOS_GRADE);
      return;
    }
    sessionStorage.setItem(KEY_PEDIDOS_GRADE, safeStringify(data));
  } catch {
    // ignore
  }
}

/** Remove filtros Excel da grade de Pedidos. */
export function clearGradeFiltrosPedidos(): void {
  try {
    sessionStorage.removeItem(KEY_PEDIDOS_GRADE);
  } catch {
    // ignore
  }
}
