import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getPedidoCompraDataEntrega,
  getPedidoCompraDataEntregaFiltrosOpcoes,
  patchPedidoCompraDataEntregaItem,
  getHistoricoAlteracaoDataEntregaItem,
  getTickets,
  getTicketById,
  getMensagemFaturamentoDiario,
  postEnviarFaturamentoDiario,
  getMensagemPedidosEntregaVencida,
  postEnviarPedidosEntregaVencida,
} from '../controllers/integracaoController.js';
import {
  getSmsTipos,
  putSmsTipos,
  putSmsDestinatarios,
  getSmsUsuarios,
  postSmsPreview,
  postSmsTestar,
} from '../controllers/integracaoSmsController.js';
import {
  getEmailTipos,
  putEmailTipos,
  putEmailDestinatarios,
  getEmailUsuarios,
  postEmailPreview,
  postEmailTestar,
} from '../controllers/integracaoEmailController.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/pedido-compra-data-entrega',
  requirePermission(PERMISSOES.INTEGRACAO_VER),
  getPedidoCompraDataEntrega
);

router.get(
  '/pedido-compra-data-entrega/filtros-opcoes',
  requirePermission(PERMISSOES.INTEGRACAO_VER),
  getPedidoCompraDataEntregaFiltrosOpcoes
);

router.patch(
  '/pedido-compra-data-entrega/item/:idItemPedidoCompra',
  requirePermission(PERMISSOES.INTEGRACAO_EDITAR),
  patchPedidoCompraDataEntregaItem
);

router.get(
  '/pedido-compra-data-entrega/item/:idItemPedidoCompra/historico',
  requirePermission(PERMISSOES.INTEGRACAO_VER),
  getHistoricoAlteracaoDataEntregaItem
);

// Tickets são usados dentro da Precificação (Engenharia). Liberamos leitura para quem pode ver/gerar precificação,
// sem precisar habilitar o módulo Integração no menu.
router.get(
  '/tickets',
  requirePermission(PERMISSOES.INTEGRACAO_VER, PERMISSOES.PRECIFICACAO_VER, PERMISSOES.PRECIFICACAO_GERAR),
  getTickets
);
router.get(
  '/tickets/:id',
  requirePermission(PERMISSOES.INTEGRACAO_VER, PERMISSOES.PRECIFICACAO_VER, PERMISSOES.PRECIFICACAO_GERAR),
  getTicketById
);

router.get('/faturamento-diario/mensagem', requirePermission(PERMISSOES.INTEGRACAO_VER), getMensagemFaturamentoDiario);
router.post('/faturamento-diario/enviar', requirePermission(PERMISSOES.INTEGRACAO_VER), postEnviarFaturamentoDiario);

router.get(
  '/pedidos-entrega-vencida/mensagem',
  requirePermission(PERMISSOES.INTEGRACAO_VER),
  getMensagemPedidosEntregaVencida
);
router.post(
  '/pedidos-entrega-vencida/enviar',
  requirePermission(PERMISSOES.INTEGRACAO_VER),
  postEnviarPedidosEntregaVencida
);

router.get('/sms/tipos', requirePermission(PERMISSOES.INTEGRACAO_VER), getSmsTipos);
router.put('/sms/tipos', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), putSmsTipos);
router.put('/sms/tipos/:id/destinatarios', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), putSmsDestinatarios);
router.get('/sms/usuarios', requirePermission(PERMISSOES.INTEGRACAO_VER), getSmsUsuarios);
router.post('/sms/tipos/:id/preview', requirePermission(PERMISSOES.INTEGRACAO_VER), postSmsPreview);
router.post('/sms/tipos/:id/testar', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), postSmsTestar);

router.get('/email/tipos', requirePermission(PERMISSOES.INTEGRACAO_VER), getEmailTipos);
router.put('/email/tipos', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), putEmailTipos);
router.put('/email/tipos/:id/destinatarios', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), putEmailDestinatarios);
router.get('/email/usuarios', requirePermission(PERMISSOES.INTEGRACAO_VER), getEmailUsuarios);
router.post('/email/tipos/:id/preview', requirePermission(PERMISSOES.INTEGRACAO_VER), postEmailPreview);
router.post('/email/tipos/:id/testar', requirePermission(PERMISSOES.INTEGRACAO_EDITAR), postEmailTestar);

export default router;
