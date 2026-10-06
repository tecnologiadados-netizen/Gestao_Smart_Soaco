/** Prefixo das rotas do módulo RH no Gestor. */
export const RH_ROUTE_PREFIX = '/rh';

/** Converte rota lógica do RH (`/organico`) em rota do Gestor (`/rh/organico`). */
export function rhPath(route: string): string {
  const raw = String(route ?? '').trim();
  if (!raw || raw === '/') return RH_ROUTE_PREFIX;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withSlash.startsWith(`${RH_ROUTE_PREFIX}/`) || withSlash === RH_ROUTE_PREFIX) return withSlash;
  return `${RH_ROUTE_PREFIX}${withSlash}`;
}

/** Rota canônica do Orgânico, opcionalmente posicionada em uma matrícula. */
export function rhOrganicoFocusPath(matricula?: unknown): string {
  const base = rhPath('/organico');
  const valor = String(matricula ?? '').trim();
  return valor ? `${base}?focusMatricula=${encodeURIComponent(valor)}` : base;
}

export type RhDashboardReturnFilters = {
  empresa: string;
  genero: 'masculino' | 'feminino' | null;
  folhaInicio: string;
  folhaFim: string;
  turnoverInicio: string;
  turnoverFim: string;
  turnoverSetor: string | null;
  movimentacoesInicio?: string;
  movimentacoesFim?: string;
  comparacaoTempoDesligamento?: 'acima' | 'abaixo';
  limiteDiasDesligamento?: number;
};

export type RhOrganicoNavigationState = {
  dashboardShortcut?: {
    returnTo: string;
    filters: RhDashboardReturnFilters;
  };
};

export type RhDashboardNavigationState = {
  dashboardRestore?: RhDashboardReturnFilters;
};

/** Remove o prefixo `/rh` para checagens de permissão internas do módulo. */
export function stripRhPath(path: string): string {
  const raw = String(path ?? '').trim();
  const [pathname, hash] = raw.split('#');
  const base = pathname ?? raw;
  let stripped = base;
  if (stripped === RH_ROUTE_PREFIX) stripped = '/';
  else if (stripped.startsWith(`${RH_ROUTE_PREFIX}/`)) stripped = stripped.slice(RH_ROUTE_PREFIX.length);
  return hash ? `${stripped}#${hash}` : stripped;
}
