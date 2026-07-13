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
