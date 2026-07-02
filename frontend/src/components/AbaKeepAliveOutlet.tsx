import { useMemo } from 'react';
import { Outlet, useLocation, useRoutes } from 'react-router-dom';
import { layoutChildRoutes } from '../layoutChildRoutes';

type AbaKeepAliveOutletProps = {
  /** Paths das abas abertas na barra superior. */
  abaPaths: string[];
};

/** Rotas que não podem ficar montadas em background (Leaflet / mapas). */
const EXCLUDE_KEEP_ALIVE = new Set(['/heatmap']);

function normalizePath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

function CachedAbaSlot({ path, isActive }: { path: string; isActive: boolean }) {
  const view = useRoutes(layoutChildRoutes, path);
  return (
    <div
      className={
        isActive
          ? 'relative flex min-h-0 min-w-0 flex-1 flex-col'
          : 'hidden'
      }
      aria-hidden={!isActive}
    >
      {view}
    </div>
  );
}

/**
 * Mantém cada aba aberta montada (estado preservado ao trocar de aba).
 * Exceção: heatmap usa `<Outlet />` único para evitar mapa Leaflet em background.
 */
export default function AbaKeepAliveOutlet({ abaPaths }: AbaKeepAliveOutletProps) {
  const { pathname } = useLocation();
  const activePath = normalizePath(pathname);

  const slotPaths = useMemo(() => {
    const set = new Set<string>();
    for (const p of abaPaths) {
      const n = normalizePath(p);
      if (!EXCLUDE_KEEP_ALIVE.has(n)) set.add(n);
    }
    if (!EXCLUDE_KEEP_ALIVE.has(activePath)) set.add(activePath);
    return [...set];
  }, [abaPaths, activePath]);

  if (EXCLUDE_KEEP_ALIVE.has(activePath)) {
    return <Outlet />;
  }

  return (
    <>
      {slotPaths.map((path) => (
        <CachedAbaSlot key={path} path={path} isActive={path === activePath} />
      ))}
    </>
  );
}
