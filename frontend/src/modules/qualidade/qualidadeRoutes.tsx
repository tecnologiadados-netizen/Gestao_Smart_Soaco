import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import QualidadeModuleLayout from '@qualidade/QualidadeModuleLayout';
import { DocumentosPage } from '@qualidade/pages/DocumentosPage';
import { DocumentosConsultaPage } from '@qualidade/pages/DocumentosConsultaPage';
import { NovoDocumentoPage } from '@qualidade/pages/DocumentosNovoPage';
import { DocumentoDetalhePage } from '@qualidade/pages/DocumentoDetalhePage';
import { ElaborarDocumentoPage } from '@qualidade/pages/DocumentoElaborarPage';
import { ConsensoDocumentoPage } from '@qualidade/pages/DocumentoConsensoPage';
import { AprovacaoDocumentoPage } from '@qualidade/pages/DocumentoAprovacaoPage';
import { CalibracoesPage } from '@qualidade/pages/CalibracoesPage';
import { CalibracoesConsultaPage } from '@qualidade/pages/CalibracoesConsultaPage';
import { CadastroEquipamentosPage } from '@qualidade/pages/CalibracoesEquipamentosPage';
import { CalibracoesVisaoGeralPage } from '@qualidade/pages/CalibracoesVisaoGeralPage';
import { RegistrosPage } from '@qualidade/pages/RegistrosPage';
import { RegistrosConsultaPage } from '@qualidade/pages/RegistrosConsultaPage';
import { AvaliacaoFornecedorRedirectPage } from '@qualidade/pages/AvaliacaoFornecedorPage';
import { AvaliacaoFornecedorHistoricoRedirectPage } from '@qualidade/pages/AvaliacaoFornecedorHistoricoPage';
import { ConfiguracoesPage } from '@qualidade/pages/ConfiguracoesPage';
import { UsuariosPage } from '@qualidade/pages/ConfiguracoesUsuariosPage';
import { SetoresPage } from '@qualidade/pages/ConfiguracoesSetoresPage';
import { TiposDocumentoPage } from '@qualidade/pages/ConfiguracoesTiposDocumentoPage';
import { VisualizarDocumentoPage } from '@qualidade/pages/DocumentosVisualizarPage';

const wrap = (element: React.ReactNode) => <ErrorBoundary>{element}</ErrorBoundary>;

export const qualidadeRoutes: RouteObject[] = [
  {
    path: 'qualidade',
    element: wrap(<QualidadeModuleLayout />),
    children: [
      { index: true, element: <Navigate to="documentos" replace /> },
      { path: 'documentos', element: wrap(<DocumentosPage />) },
      { path: 'documentos/consulta', element: wrap(<DocumentosConsultaPage />) },
      { path: 'documentos/novo', element: wrap(<NovoDocumentoPage />) },
      { path: 'documentos/visualizar', element: wrap(<VisualizarDocumentoPage />) },
      { path: 'documentos/:id', element: wrap(<DocumentoDetalhePage />) },
      { path: 'documentos/:id/elaborar', element: wrap(<ElaborarDocumentoPage />) },
      { path: 'documentos/:id/consenso', element: wrap(<ConsensoDocumentoPage />) },
      { path: 'documentos/:id/aprovacao', element: wrap(<AprovacaoDocumentoPage />) },
      { path: 'calibracoes', element: wrap(<CalibracoesPage />) },
      { path: 'calibracoes/consulta', element: wrap(<CalibracoesConsultaPage />) },
      { path: 'calibracoes/cadastros/equipamentos', element: wrap(<CadastroEquipamentosPage />) },
      { path: 'calibracoes/visao-geral', element: wrap(<CalibracoesVisaoGeralPage />) },
      { path: 'registros', element: wrap(<RegistrosPage />) },
      { path: 'registros/consulta', element: wrap(<RegistrosConsultaPage />) },
      { path: 'avaliacao-fornecedor', element: wrap(<AvaliacaoFornecedorRedirectPage />) },
      { path: 'avaliacao-fornecedor/historico', element: wrap(<AvaliacaoFornecedorHistoricoRedirectPage />) },
      { path: 'configuracoes', element: wrap(<ConfiguracoesPage />) },
      { path: 'configuracoes/usuarios', element: wrap(<UsuariosPage />) },
      { path: 'configuracoes/setores', element: wrap(<SetoresPage />) },
      { path: 'configuracoes/tipos-documento', element: wrap(<TiposDocumentoPage />) },
    ],
  },
];
