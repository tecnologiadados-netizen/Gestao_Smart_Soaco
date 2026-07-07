import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RootEntry from './RootEntry';
import Layout from './components/Layout';
import { layoutChildRoutes } from './layoutChildRoutes';

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export const router = createBrowserRouter(
  [
    {
      path: '/entrar',
      element: <Navigate to="/" replace />,
    },
    {
      path: '/',
      element: (
        <AuthProvider>
          <RootEntry />
        </AuthProvider>
      ),
      /**
       * Rota splat: Layout + filhas via <Outlet /> com transição de tela.
       * RootEntry autenticado renderiza <Outlet /> (não <Layout /> direto).
       */
      children: [{ path: '*', element: <Layout />, children: layoutChildRoutes }],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { future }
);
