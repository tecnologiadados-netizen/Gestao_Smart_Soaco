import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import PdvConfigPage from '@pdv/pages/PdvConfigPage';

const wrap = (element: ReactNode) => <ErrorBoundary>{element}</ErrorBoundary>;

/** Configuração continua no menu do Gestão. O balcão em /pdv fica fora desse layout. */
export const pdvRoutes: RouteObject[] = [
  {
    path: 'pdv/configuracao',
    element: wrap(<PdvConfigPage />),
  },
];
