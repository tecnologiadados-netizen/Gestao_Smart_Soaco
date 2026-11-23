import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FavoritosProvider } from './contexts/FavoritosContext';
import { FavoritoVisaoAtualProvider } from './contexts/FavoritoVisaoAtualContext';
import RootEntry from './RootEntry';
import Layout from './components/Layout';
import TransicaoRotaProvider from './components/TransicaoRotaProvider';
import { layoutChildRoutes } from './layoutChildRoutes';
import { VisualizarDocumentoPage } from './modules/qualidade/pages/DocumentosVisualizarPage';
import PdvEntry from './modules/pdv/PdvEntry';
import EspelhoDivergenciaPublicaPage from './pages/compras/EspelhoDivergenciaPublicaPage';

const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export const router = createBrowserRouter(
  [
    /**
     * Link público da evidência do Double Check — fora do RootEntry/Layout.
     * Se ficar como filha do splat `*`, usuário logado cai no shell vazio (tela preta).
     */
    {
      path: '/e/:token',
      element: <EspelhoDivergenciaPublicaPage />,
    },
    {
      path: '/entrar',
      element: <Navigate to="/" replace />,
    },
    {
      path: '/',
      element: (
        <AuthProvider>
          <FavoritosProvider>
            <FavoritoVisaoAtualProvider>
              <RootEntry />
            </FavoritoVisaoAtualProvider>
          </FavoritosProvider>
        </AuthProvider>
      ),
      /**
       * Rota splat: Layout + filhas via <Outlet /> com transição de tela.
       * RootEntry autenticado renderiza <Outlet /> (não <Layout /> direto).
       */
      children: [
        {
          path: 'qualidade/documentos/visualizar',
          element: <VisualizarDocumentoPage />,
        },
        {
          path: 'pdv',
          element: <PdvEntry />,
        },
        {
          path: '*',
          element: (
            <TransicaoRotaProvider>
              <Layout />
            </TransicaoRotaProvider>
          ),
          children: layoutChildRoutes,
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { future }
);
