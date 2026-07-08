import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import PedidosPage from './pages/PedidosPage';
import RelatoriosPage from './pages/RelatoriosPage';
import UsuariosPage from './pages/UsuariosPage';
import WhatsAppConnectPage from './pages/WhatsAppConnectPage';
import StatusApiPage from './pages/StatusApiPage';
import HeatmapPage from './pages/HeatmapPage';
import IntegracaoPage from './pages/IntegracaoPage';
import AlteracaoDataEntregaCompraPage from './pages/integracao/AlteracaoDataEntregaCompraPage';
import FaturamentoDiarioPage from './pages/integracao/FaturamentoDiarioPage';
import PedidosEntregaVencidaPage from './pages/integracao/PedidosEntregaVencidaPage';
import SmsIntegracaoPage from './pages/integracao/SmsIntegracaoPage';
import CredenciaisPage from './pages/integracao/CredenciaisPage';
import EmailCredenciaisPage from './pages/integracao/EmailCredenciaisPage';
import ComprasPage from './pages/ComprasPage';
import ColetasPrecosPage from './pages/compras/ColetasPrecosPage';
import ComprasDashboardPage from './pages/compras/ComprasDashboardPage';
import PreCompraPage from './pages/compras/PreCompraPage';
import PendenciasComprasPage from './pages/compras/PendenciasComprasPage';
import PrecificacaoPage from './pages/PrecificacaoPage';
import ResumoFinanceiroPage from './pages/financeiro/ResumoFinanceiroPage';
import DfcPage from './pages/financeiro/DfcPage';
import DrePage from './pages/financeiro/DrePage';
import PainelFinanceiroComercialPage from './pages/financeiro/PainelFinanceiroComercialPage';
import RenegociacaoContratosPage from './pages/financeiro/RenegociacaoContratosPage';
import CrmFinanceiroPage from './pages/financeiro/CrmFinanceiroPage';
import SycroOrderPage from './pages/pedidos/SycroOrderPage';
import MRPPage from './pages/pedidos/MRPPage';
import MRPManagerPage from './pages/pedidos/MRPManagerPage';
import MRPProdutosEmProcessoPage from './pages/pedidos/MRPProdutosEmProcessoPage';
import DashboardPage from './pages/DashboardPage';
import DashboardMRPPage from './pages/pedidos/DashboardMRPPage';
import MPPPage from './pages/pedidos/MPPPage';
import ProgramacaoSetorialPainelPage from './pages/pedidos/ProgramacaoSetorialPainelPage';
import ProgramacaoProducaoPage, {
  ProgramacaoProducaoLegacyRedirect,
} from './pages/pedidos/ProgramacaoProducaoPage';
import ProgramacaoProducaoRecursosPage from './pages/pedidos/ProgramacaoProducaoRecursosPage';
import RessupAlmoxAnalisePage from './pages/pedidos/RessupAlmoxAnalisePage';
import RessupNaoAlmoxAnalisePage from './pages/pedidos/RessupNaoAlmoxAnalisePage';
import SequenciamentoCarradasPage from './pages/pedidos/SequenciamentoCarradasPage';
import RegrasDataEntregaPage from './pages/pedidos/RegrasDataEntregaPage';
import ConsultaEstoquePage from './pages/pedidos/ConsultaEstoquePage';
import PedidosEncerradosPage from './pages/pedidos/PedidosEncerradosPage';
import SuportePage from './pages/suporte/SuportePage';
import SuporteConfigPage from './pages/suporte/SuporteConfigPage';
import SemAcessoPage from './pages/SemAcessoPage';
import InicioPage from './pages/InicioPage';
import MindMapsPage, { MindMapsLegacyRedirect } from './pages/mind-maps/MindMapsPage';
import VeiculosPage from './pages/logistica/VeiculosPage';
import ProdutosCubagemPage from './pages/logistica/ProdutosCubagemPage';
import SimulacaoCubagemPage from './pages/logistica/SimulacaoCubagemPage';
import { qualidadeRoutes } from './modules/qualidade/qualidadeRoutes';

/** Rotas filhas do layout autenticado (espelham appRouter). */
export const layoutChildRoutes: RouteObject[] = [
  { index: true, element: <InicioPage /> },
  { path: 'pedidos/dash-entregas', element: <ErrorBoundary><DashboardPage /></ErrorBoundary> },
  { path: 'pedidos/sequenciamento-carradas', element: <ErrorBoundary><SequenciamentoCarradasPage /></ErrorBoundary> },
  { path: 'pedidos', element: <ErrorBoundary><PedidosPage /></ErrorBoundary> },
  { path: 'pedidos/encerrados', element: <ErrorBoundary><PedidosEncerradosPage /></ErrorBoundary> },
  { path: 'pedidos/sycroorder', element: <ErrorBoundary><SycroOrderPage /></ErrorBoundary> },
  { path: 'pedidos/mrp', element: <ErrorBoundary><MRPManagerPage /></ErrorBoundary> },
  { path: 'pedidos/mrp/:id', element: <ErrorBoundary><MRPPage /></ErrorBoundary> },
  { path: 'pedidos/mrp-produtos-em-processo', element: <ErrorBoundary><MRPProdutosEmProcessoPage /></ErrorBoundary> },
  { path: 'pedidos/mrp-dashboard', element: <ErrorBoundary><DashboardMRPPage /></ErrorBoundary> },
  { path: 'pedidos/mpp', element: <ErrorBoundary><MPPPage /></ErrorBoundary> },
  { path: 'pedidos/programacao-setorial', element: <ErrorBoundary><ProgramacaoSetorialPainelPage /></ErrorBoundary> },
  { path: 'pedidos/programacao-producao', element: <ErrorBoundary><ProgramacaoProducaoPage /></ErrorBoundary> },
  {
    path: 'pedidos/programacao-producao/recursos',
    element: (
      <ErrorBoundary>
        <ProgramacaoProducaoRecursosPage />
      </ErrorBoundary>
    ),
  },
  {
    path: 'pedidos/regras-data-entrega',
    element: (
      <ErrorBoundary>
        <RegrasDataEntregaPage />
      </ErrorBoundary>
    ),
  },
  { path: 'pedidos/programacao-producao/novo', element: <ProgramacaoProducaoLegacyRedirect /> },
  { path: 'pedidos/programacao-producao/:id/editar', element: <ProgramacaoProducaoLegacyRedirect /> },
  { path: 'pedidos/programacao-producao/:id/visualizar', element: <ProgramacaoProducaoLegacyRedirect /> },
  { path: 'pedidos/ressup-almox', element: <ErrorBoundary><RessupAlmoxAnalisePage /></ErrorBoundary> },
  { path: 'pedidos/ressup-nao-almox', element: <ErrorBoundary><RessupNaoAlmoxAnalisePage /></ErrorBoundary> },
  { path: 'pedidos/consulta-estoque', element: <ErrorBoundary><ConsultaEstoquePage /></ErrorBoundary> },
  { path: 'suporte', element: <ErrorBoundary><SuportePage /></ErrorBoundary> },
  { path: 'suporte/configuracao', element: <ErrorBoundary><SuporteConfigPage /></ErrorBoundary> },
  { path: 'heatmap', element: <HeatmapPage /> },
  { path: 'mind-maps', element: <ErrorBoundary><MindMapsPage /></ErrorBoundary> },
  { path: 'mind-maps/novo', element: <MindMapsLegacyRedirect /> },
  { path: 'mind-maps/:id/editar', element: <MindMapsLegacyRedirect /> },
  { path: 'mind-maps/:id/visualizar', element: <MindMapsLegacyRedirect /> },
  { path: 'compras', element: <ComprasPage /> },
  { path: 'compras/dashboard', element: <ComprasDashboardPage /> },
  { path: 'compras/coletas-precos', element: <ColetasPrecosPage /> },
  { path: 'compras/pre-compra', element: <ErrorBoundary><PreCompraPage /></ErrorBoundary> },
  { path: 'compras/rotina/pendencias', element: <ErrorBoundary><PendenciasComprasPage /></ErrorBoundary> },
  { path: 'precificacao', element: <Navigate to="/engenharia/precificacao" replace /> },
  { path: 'engenharia/precificacao', element: <PrecificacaoPage /> },
  ...qualidadeRoutes,
  { path: 'financeiro', element: <ResumoFinanceiroPage /> },
  { path: 'financeiro/resumo', element: <ResumoFinanceiroPage /> },
  { path: 'financeiro/dfc', element: <DfcPage /> },
  { path: 'financeiro/dre', element: <ErrorBoundary><DrePage /></ErrorBoundary> },
  { path: 'financeiro/painel-financeiro-comercial', element: <PainelFinanceiroComercialPage /> },
  { path: 'financeiro/renegociacao-contratos', element: <RenegociacaoContratosPage /> },
  { path: 'financeiro/crm', element: <ErrorBoundary><CrmFinanceiroPage /></ErrorBoundary> },
  { path: 'logistica/cubagem/veiculos', element: <ErrorBoundary><VeiculosPage /></ErrorBoundary> },
  { path: 'logistica/cubagem/produtos', element: <ErrorBoundary><ProdutosCubagemPage /></ErrorBoundary> },
  { path: 'logistica/cubagem/simulacao', element: <ErrorBoundary><SimulacaoCubagemPage /></ErrorBoundary> },
  { path: 'relatorios', element: <RelatoriosPage /> },
  { path: 'integracao', element: <IntegracaoPage /> },
  { path: 'integracao/alteracao-data-entrega-compra', element: <AlteracaoDataEntregaCompraPage /> },
  { path: 'integracao/faturamento-diario', element: <FaturamentoDiarioPage /> },
  { path: 'integracao/pedidos-entrega-vencida', element: <PedidosEntregaVencidaPage /> },
  { path: 'integracao/sms', element: <SmsIntegracaoPage /> },
  { path: 'integracao/credenciais', element: <CredenciaisPage /> },
  { path: 'integracao/credenciais/email', element: <EmailCredenciaisPage /> },
  { path: 'usuarios', element: <UsuariosPage /> },
  { path: 'usuarios/grupos', element: <UsuariosPage /> },
  { path: 'whatsapp', element: <WhatsAppConnectPage /> },
  { path: 'situacao-api', element: <StatusApiPage /> },
  { path: 'sem-acesso', element: <SemAcessoPage /> },
];
