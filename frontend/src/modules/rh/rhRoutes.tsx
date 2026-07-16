import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import RhModuleRoot from '@rh/RhModuleRoot';
import { isAuthenticated } from '@rh/lib/auth';
import { getDefaultPostLoginPath, hasRoutePermission } from '@rh/lib/route-permissions';
import { rhPath } from '@rh/lib/rh-paths';
import SemAcesso from '@rh/pages/SemAcesso';
import NotFound from '@rh/pages/NotFound';

function lazyImportWithRetry<T extends { default: React.ComponentType<object> }>(
  importer: () => Promise<T>,
): Promise<T> {
  return importer().catch((err) => {
    console.warn('[rh/lazy] Falha ao carregar módulo, tentando novamente…', err);
    return importer();
  });
}

const Dashboard = lazy(() => lazyImportWithRetry(() => import('@rh/pages/Dashboard')));
const Cargos = lazy(() => lazyImportWithRetry(() => import('@rh/pages/Cargos')));
const Organograma = lazy(() => lazyImportWithRetry(() => import('@rh/pages/Organograma')));
const Organico = lazy(() => lazyImportWithRetry(() => import('@rh/pages/Organico')));
const FaltasAtestados = lazy(() => lazyImportWithRetry(() => import('@rh/pages/FaltasAtestados')));
const Configuracoes = lazy(() => lazyImportWithRetry(() => import('@rh/pages/Configuracoes')));

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-foreground">Não foi possível carregar esta página.</p>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children, path }: { children: React.ReactNode; path?: string }) {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  if (path && !hasRoutePermission(path)) return <Navigate to={rhPath('/sem-acesso')} replace />;
  return <>{children}</>;
}

const wrap = (element: React.ReactNode) => (
  <ErrorBoundary>
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Carregando...</div>
        }
      >
        {element}
      </Suspense>
    </RouteErrorBoundary>
  </ErrorBoundary>
);

export const rhRoutes: RouteObject[] = [
  {
    path: 'rh',
    element: <RhModuleRoot />,
    children: [
      {
        index: true,
        element: (
          <Navigate
            to={
              isAuthenticated()
                ? getDefaultPostLoginPath().replace(/^\/rh\/?/, '') || 'dashboard'
                : '/'
            }
            replace
          />
        ),
      },
      { path: 'sem-acesso', element: wrap(<SemAcesso />) },
      {
        path: 'dashboard',
        element: wrap(
          <ProtectedRoute path={rhPath('/dashboard')}>
            <Dashboard />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'cargos',
        element: wrap(
          <ProtectedRoute path={rhPath('/cargos')}>
            <Cargos />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'organograma',
        element: wrap(
          <ProtectedRoute path={rhPath('/organograma')}>
            <Organograma />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'organico',
        element: wrap(
          <ProtectedRoute path={rhPath('/organico')}>
            <Organico />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'faltas-atestados',
        element: wrap(
          <ProtectedRoute path={rhPath('/faltas-atestados')}>
            <FaltasAtestados />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'configuracoes',
        element: wrap(
          <ProtectedRoute path={rhPath('/configuracoes')}>
            <Configuracoes />
          </ProtectedRoute>,
        ),
      },
      { path: '*', element: wrap(<NotFound />) },
    ],
  },
];
