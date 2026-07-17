import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  PERMISSOES_ACESSO_FINANCEIRO_DFC,
  PERMISSOES_ACESSO_FINANCEIRO_DRE,
  PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL,
  PERMISSOES_ACESSO_FINANCEIRO_CRM,
  PERMISSOES_ACESSO_FINANCEIRO_CRM_EMPRESA,
  PERMISSOES_ACESSO_FINANCEIRO_CRM_CLIENTE,
  PERMISSOES_ACESSO_FINANCEIRO_CRM_PENDENCIAS,
  PERMISSOES_EDITAR_CRM_PENDENCIAS_DESTINATARIOS,
} from '../utils/financeiroPermissoes.js';
import {
  getDfcAgendamentosEfetivos,
  getDfcAgendamentosDetalhe,
  getDfcContasBancarias,
  getDfcDespesasPagamentoEmAberto,
  getDfcDespesasPagamentoFornecedorOpcoes,
  getDfcEndividamentoBancario,
  getDfcKpis,
  getDfcSaldosBancarios,
  getDfcProjecaoReceitas,
  getDfcProjecaoReceitasDetalhe,
  getDfcSaldoFaturar,
  getDfcShop9Status,
  getDreReceitaIndiretaDetalhe,
  getDreReceitaIndiretaProdutos,
  getDreReceitaMoveisDireto,
  getDreReceitaMoveisDiretoDetalhe,
  getDreReceitaRefrigeracaoShop9,
  getDreReceitaVendasDetalhe,
  getDreReceitaVendasProdutos,
  getDreCpvSoAco,
  getDreCpvMoveisDireto,
  getDreDevolucoes,
  getDreDevolucoesDetalhe,
  getDreSaidasSoAco,
  getDreFornecedorOpcoes,
  getDreRateioFornecedorTotais,
  getDreSaidasSoAcoDetalhe,
  getDreSaidasNomusDetalhe,
  getDreRelacaoPc,
  putDreRelacaoPc,
  deleteDreRelacaoPcOverrides,
  getDreRateioConfig,
  putDreRateioConfig,
  getPainelComercial,
  getPainelComercialItensPedido,
  getPoliticaComercialPainel,
  putPoliticaComercialPainel,
  getPoliticaComercialClientes,
} from '../controllers/financeiroController.js';
import {
  deletePrioridadeContaCtrl,
  deletePrioridadeLancamentoCtrl,
  getOpcoesPrioridade,
  listPrioridadesConta,
  listPrioridadesLancamento,
  postPrioridadeContaLote,
  postPrioridadeLancamentoLote,
  putPrioridadeConta,
  putPrioridadeLancamento,
} from '../controllers/dfcPrioridadeController.js';
import {
  getCrmDashboard,
  getCrmDetalhe,
  getCrmEmpresas,
  getCrmPessoas,
  getCrmSaudeEmpresa,
} from '../controllers/crmFinanceiroController.js';
import {
  getCrmPendenciasCredito,
  getCrmPendenciasContasCliente,
  getCrmPendenciasEmailConfig,
  getCrmPendenciasHistorico,
  getCrmPendenciasPedidosDestino,
  getCrmPendenciasUsuarios,
  postCrmPendenciaAcao,
  postCrmPendenciaConfirmarLiberacao,
  putCrmPendenciasEmailConfig,
} from '../controllers/crmCreditoPendenciasController.js';

const router = Router();
router.use(requireAuth);

const verFinanceiroDfc = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_DFC);
const verFinanceiroDre = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_DRE);
const verFinanceiroPainelComercial = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL);
const verFinanceiroCrm = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_CRM);
const verFinanceiroCrmEmpresa = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_CRM_EMPRESA);
const verFinanceiroCrmCliente = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_CRM_CLIENTE);
const verFinanceiroCrmPendencias = requirePermission(...PERMISSOES_ACESSO_FINANCEIRO_CRM_PENDENCIAS);
const editarCrmPendenciasDestinatarios = requirePermission(
  ...PERMISSOES_EDITAR_CRM_PENDENCIAS_DESTINATARIOS
);

router.get('/dfc/agendamentos-efetivos', verFinanceiroDfc, getDfcAgendamentosEfetivos);
router.get('/dfc/projecao-receitas', verFinanceiroDfc, getDfcProjecaoReceitas);
router.get('/dfc/projecao-receitas/detalhe', verFinanceiroDfc, getDfcProjecaoReceitasDetalhe);
router.get('/dfc/agendamentos-efetivos-detalhe', verFinanceiroDfc, getDfcAgendamentosDetalhe);
router.get('/dfc/contas-bancarias', verFinanceiroDfc, getDfcContasBancarias);
router.get('/dfc/despesas-pagamento-em-aberto', verFinanceiroDfc, getDfcDespesasPagamentoEmAberto);
router.get('/dfc/despesas-em-aberto-fornecedor-opcoes', verFinanceiroDfc, getDfcDespesasPagamentoFornecedorOpcoes);
router.get('/dfc/endividamento-bancario', verFinanceiroDfc, getDfcEndividamentoBancario);
router.get('/dfc/kpis', verFinanceiroDfc, getDfcKpis);
router.get('/dfc/saldos-bancarios', verFinanceiroDfc, getDfcSaldosBancarios);
router.get('/dfc/saldo-faturar', verFinanceiroDfc, getDfcSaldoFaturar);
router.get('/dfc/shop9-status', verFinanceiroDfc, getDfcShop9Status);

router.get('/dre/receita-vendas-produtos/detalhe', verFinanceiroDre, getDreReceitaVendasDetalhe);
router.get('/dre/receita-vendas-produtos', verFinanceiroDre, getDreReceitaVendasProdutos);
router.get('/dre/receita-indireta-produtos/detalhe', verFinanceiroDre, getDreReceitaIndiretaDetalhe);
router.get('/dre/receita-indireta-produtos', verFinanceiroDre, getDreReceitaIndiretaProdutos);
router.get('/dre/receita-moveis-direto/detalhe', verFinanceiroDre, getDreReceitaMoveisDiretoDetalhe);
router.get('/dre/receita-moveis-direto', verFinanceiroDre, getDreReceitaMoveisDireto);
router.get('/dre/receita-refrigeracao-shop9', verFinanceiroDre, getDreReceitaRefrigeracaoShop9);
router.get('/dre/cpv-so-aco', verFinanceiroDre, getDreCpvSoAco);
router.get('/dre/cpv-moveis-direto', verFinanceiroDre, getDreCpvMoveisDireto);
router.get('/dre/devolucoes/detalhe', verFinanceiroDre, getDreDevolucoesDetalhe);
router.get('/dre/devolucoes', verFinanceiroDre, getDreDevolucoes);
router.get('/dre/saidas-soaco', verFinanceiroDre, getDreSaidasSoAco);
router.get('/dre/saidas-soaco/fornecedor-opcoes', verFinanceiroDre, getDreFornecedorOpcoes);
router.get('/dre/saidas-soaco/rateio-fornecedores', verFinanceiroDre, getDreRateioFornecedorTotais);
router.get('/dre/saidas-soaco/detalhe', verFinanceiroDre, getDreSaidasSoAcoDetalhe);
router.get('/dre/saidas-soaco/detalhe-nomus', verFinanceiroDre, getDreSaidasNomusDetalhe);
router.get('/dre/relacao-pc', verFinanceiroDre, getDreRelacaoPc);
router.put('/dre/relacao-pc', verFinanceiroDre, putDreRelacaoPc);
router.delete('/dre/relacao-pc', verFinanceiroDre, deleteDreRelacaoPcOverrides);
router.get('/dre/rateio-config', verFinanceiroDre, getDreRateioConfig);
router.put('/dre/rateio-config', verFinanceiroDre, putDreRateioConfig);

// Prioridade DFC (plano de contas + lançamento)
router.get('/dfc/prioridades/opcoes', verFinanceiroDfc, getOpcoesPrioridade);
router.get('/dfc/prioridades/contas', verFinanceiroDfc, listPrioridadesConta);
router.put('/dfc/prioridades/contas', verFinanceiroDfc, putPrioridadeConta);
router.post('/dfc/prioridades/contas/lote', verFinanceiroDfc, postPrioridadeContaLote);
router.delete('/dfc/prioridades/contas/:idEmpresa/:idContaFinanceiro', verFinanceiroDfc, deletePrioridadeContaCtrl);
router.get('/dfc/prioridades/lancamentos', verFinanceiroDfc, listPrioridadesLancamento);
router.put('/dfc/prioridades/lancamentos', verFinanceiroDfc, putPrioridadeLancamento);
router.post('/dfc/prioridades/lancamentos/lote', verFinanceiroDfc, postPrioridadeLancamentoLote);
router.delete('/dfc/prioridades/lancamentos/:idEmpresa/:tipoRef/:idRef', verFinanceiroDfc, deletePrioridadeLancamentoCtrl);

router.get('/painel-comercial/itens-pedido', verFinanceiroPainelComercial, getPainelComercialItensPedido);
router.get('/painel-comercial/politica/clientes', verFinanceiroPainelComercial, getPoliticaComercialClientes);
router.get('/painel-comercial/politica', verFinanceiroPainelComercial, getPoliticaComercialPainel);
router.put('/painel-comercial/politica', verFinanceiroPainelComercial, putPoliticaComercialPainel);
router.get('/painel-comercial', verFinanceiroPainelComercial, getPainelComercial);

router.get('/crm/dashboard', verFinanceiroCrm, getCrmDashboard);
router.get('/crm/detalhe', verFinanceiroCrm, getCrmDetalhe);
router.get('/crm/saude-empresa', verFinanceiroCrmEmpresa, getCrmSaudeEmpresa);
router.get('/crm/pessoas', verFinanceiroCrmCliente, getCrmPessoas);
router.get('/crm/empresas', verFinanceiroCrm, getCrmEmpresas);

router.get('/crm/pendencias-credito/email-config', verFinanceiroCrmPendencias, getCrmPendenciasEmailConfig);
router.put(
  '/crm/pendencias-credito/email-config',
  editarCrmPendenciasDestinatarios,
  putCrmPendenciasEmailConfig
);
router.get('/crm/pendencias-credito/usuarios', verFinanceiroCrmPendencias, getCrmPendenciasUsuarios);
router.get('/crm/pendencias-credito/historico', verFinanceiroCrmPendencias, getCrmPendenciasHistorico);
router.get('/crm/pendencias-credito/contas', verFinanceiroCrmPendencias, getCrmPendenciasContasCliente);
router.get(
  '/crm/pendencias-credito/pedidos-destino',
  verFinanceiroCrmPendencias,
  getCrmPendenciasPedidosDestino
);
router.get('/crm/pendencias-credito', verFinanceiroCrmPendencias, getCrmPendenciasCredito);
router.post('/crm/pendencias-credito/:id/acao', verFinanceiroCrmPendencias, postCrmPendenciaAcao);
router.post(
  '/crm/pendencias-credito/:id/confirmar-liberacao',
  verFinanceiroCrmPendencias,
  postCrmPendenciaConfirmarLiberacao
);

export default router;
