import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { PERMISSOES_ACESSO_FINANCEIRO_RESUMO } from '../utils/financeiroPermissoes.js';
import {
  PERMISSOES_ACESSO_SEQUENCIAMENTO_CARRADAS,
  PERMISSOES_EDITAR_SEQUENCIAMENTO_CARRADAS,
} from '../utils/sequenciamentoCarradasPermissoes.js';
import {
  getPedidos,
  getPedidosEncerrados,
  getPedidosEncerradosTypeahead,
  getPedidosExport,
  getResumo,
  getResumoFinanceiro,
  getResumoFinanceiroGrade,
  getResumoStatusPorTipoF,
  getTabelaStatusPorTipoF,
  getResumoObservacoes,
  getResumoMotivos,
  getDashEntregasAnalytics,
  getDashEntregasAgingTipoF,
  getDashEntregasLeadTimeTipoF,
  getDashEntregasFiltrosOpcoes,
  getFiltrosOpcoes,
  getMapaMunicipios,
  getMapaMunicipioDetalhes,
  getCargasSeparadasMesmoClienteCidade,
  ajustarPrevisao,
  ajustarPrevisaoLote,
  ajustarDataProducaoLote,
  getHistorico,
  getInconsistenciaQtdePendente,
  sincronizar,
  checkIdPedidosEmSycro,
} from '../controllers/pedidosController.js';
import {
  postSequenciamentoCarradasSnapshot,
  getSequenciamentoCarradasSnapshots,
  getSequenciamentoCarradasConsultaAoVivo,
  getSequenciamentoCarradasSnapshotById,
  patchSequenciamentoCarradasSnapshot,
  postSequenciamentoCarradasSnapshotConcluir,
  deleteSequenciamentoCarradasSnapshot,
} from '../controllers/sequenciamentoCarradasController.js';
import {
  getSequenciamentoSnapshotAgPag,
  getSequenciamentoSnapshotPcPend,
  getSequenciamentoSnapshotSolicitacao,
  postSequenciamentoConsultaCongelada,
} from '../controllers/sequenciamentoConsultaCongeladaController.js';
import {
  postDisponibilidadeMateriaisDia,
  postDisponibilidadeMateriaisItem,
  postDisponibilidadeMateriaisSintetica,
} from '../controllers/disponibilidadeMateriaisCalendarioController.js';

const router = Router();
router.use(requireAuth);

// Visualização do gerenciador/recursos (PCP/Dashboard/Heatmap).
// Compatibilidade: Comunicação PD precisa listar itens para criação de cards.
const verPedidos = requirePermission(
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.DASHBOARD_VER,
  PERMISSOES.HEATMAP_VER,
  PERMISSOES.COMUNICACAO_TELA_VER,
  PERMISSOES.COMUNICACAO_NOVO_PEDIDO,
  // legado
  PERMISSOES.PEDIDOS_VER,
  PERMISSOES.COMUNICACAO_VER
);

const verFinanceiro = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_RESUMO, PERMISSOES.PCP_TOTAL);

// Rate limit para rotas de escrita (ajustar previsão)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
});

// Consultas congeladas do Calendário: gravam, mas são leitura sob demanda (até 3 chamadas por
// produto aberto), então o teto do writeLimiter é apertado demais para navegação normal.
const consultaCongeladaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Muitas consultas. Tente novamente em breve.' },
});

const editarPcp = requirePermission(PERMISSOES.PCP_AJUSTAR_PREVISAO, PERMISSOES.PCP_IMPORTAR_XLSX, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_EDITAR);
const exportarXlsxPcp = requirePermission(PERMISSOES.PCP_EXPORTAR_XLSX, PERMISSOES.PCP_EXPORTAR_GRADE, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_EDITAR);
const ajustarUnicoPcp = requirePermission(PERMISSOES.PCP_AJUSTAR_PREVISAO, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_EDITAR);
const ajustarLotePcp = requirePermission(PERMISSOES.PCP_IMPORTAR_XLSX, PERMISSOES.PCP_AJUSTAR_PREVISAO, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_EDITAR);

const verSequenciamentoCarradas = requirePermission(...PERMISSOES_ACESSO_SEQUENCIAMENTO_CARRADAS);
const editarSequenciamentoCarradas = requirePermission(...PERMISSOES_EDITAR_SEQUENCIAMENTO_CARRADAS);

router.get('/', verPedidos, getPedidos);
router.get('/export', exportarXlsxPcp, getPedidosExport);
router.get('/resumo', verPedidos, getResumo);
router.get('/resumo-financeiro', verPedidos, getResumoFinanceiro);
router.get('/resumo-financeiro-grade', verFinanceiro, getResumoFinanceiroGrade);
router.get('/resumo-status-tipof', verPedidos, getResumoStatusPorTipoF);
router.get('/tabela-status-tipof', verPedidos, getTabelaStatusPorTipoF);
router.get('/observacoes-resumo', verPedidos, getResumoObservacoes);
router.get('/dash-entregas-analytics', verPedidos, getDashEntregasAnalytics);
router.get('/dash-entregas-aging-tipof', verPedidos, getDashEntregasAgingTipoF);
router.get('/dash-entregas-leadtime-tipof', verPedidos, getDashEntregasLeadTimeTipoF);
router.get('/dash-entregas-filtros-opcoes', verPedidos, getDashEntregasFiltrosOpcoes);
router.get('/resumo-motivos', verPedidos, getResumoMotivos);
router.get('/filtros-opcoes', verPedidos, getFiltrosOpcoes);
router.get('/mapa-municipios', verPedidos, getMapaMunicipios);
router.get('/mapa-municipios/detalhes', verPedidos, getMapaMunicipioDetalhes);
router.get('/cargas-separadas-cliente-cidade', verPedidos, getCargasSeparadasMesmoClienteCidade);
// Limiter dedicado ao autosave do rascunho (mais frequente que os writes normais).
const autosaveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
});

router.get('/sequenciamento-carradas/consulta-ao-vivo', verSequenciamentoCarradas, getSequenciamentoCarradasConsultaAoVivo);
router.get('/sequenciamento-carradas/snapshots', verSequenciamentoCarradas, getSequenciamentoCarradasSnapshots);
router.post('/sequenciamento-carradas/snapshots', editarSequenciamentoCarradas, writeLimiter, postSequenciamentoCarradasSnapshot);
router.get('/sequenciamento-carradas/snapshots/:id', verSequenciamentoCarradas, getSequenciamentoCarradasSnapshotById);
router.patch('/sequenciamento-carradas/snapshots/:id', editarSequenciamentoCarradas, autosaveLimiter, patchSequenciamentoCarradasSnapshot);
router.post('/sequenciamento-carradas/snapshots/:id/concluir', editarSequenciamentoCarradas, writeLimiter, postSequenciamentoCarradasSnapshotConcluir);
router.delete('/sequenciamento-carradas/snapshots/:id', editarSequenciamentoCarradas, writeLimiter, deleteSequenciamentoCarradasSnapshot);
router.get('/sequenciamento-carradas/snapshots/:id/pc-pend', verSequenciamentoCarradas, getSequenciamentoSnapshotPcPend);
router.get('/sequenciamento-carradas/snapshots/:id/ag-pag', verSequenciamentoCarradas, getSequenciamentoSnapshotAgPag);
router.get(
  '/sequenciamento-carradas/snapshots/:id/solicitacao',
  verSequenciamentoCarradas,
  getSequenciamentoSnapshotSolicitacao
);
router.post(
  '/sequenciamento-carradas/snapshots/:id/consulta-congelada',
  verSequenciamentoCarradas,
  consultaCongeladaLimiter,
  postSequenciamentoConsultaCongelada
);
router.post(
  '/sequenciamento-carradas/calendario-producao/disponibilidade-materiais',
  verSequenciamentoCarradas,
  writeLimiter,
  postDisponibilidadeMateriaisSintetica
);
router.post(
  '/sequenciamento-carradas/calendario-producao/disponibilidade-materiais/dia',
  verSequenciamentoCarradas,
  writeLimiter,
  postDisponibilidadeMateriaisDia
);
router.post(
  '/sequenciamento-carradas/calendario-producao/disponibilidade-materiais/item',
  verSequenciamentoCarradas,
  writeLimiter,
  postDisponibilidadeMateriaisItem
);
router.get('/inconsistencia-qtde-pendente', verPedidos, getInconsistenciaQtdePendente);
router.get('/encerrados/typeahead', verPedidos, getPedidosEncerradosTypeahead);
router.get('/encerrados', verPedidos, getPedidosEncerrados);
router.get('/:id/historico', verPedidos, getHistorico);
router.post('/check-sycro', verPedidos, checkIdPedidosEmSycro);

// Sincronizar: qualquer usuário autenticado (evita 403 ao acessar por IP externo)
router.post('/sincronizar', writeLimiter, sincronizar);
router.post('/ajustar-previsao-lote', ajustarLotePcp, writeLimiter, ajustarPrevisaoLote);
router.post('/data-producao-lote', ajustarLotePcp, writeLimiter, ajustarDataProducaoLote);
router.post('/:id/ajustar-previsao', ajustarUnicoPcp, writeLimiter, ajustarPrevisao);

export default router;
