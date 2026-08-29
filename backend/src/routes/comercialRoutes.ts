import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  PERMISSOES_ACESSO_COMERCIAL_PAINEL,
  PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS,
  PERMISSOES_ACESSO_COMERCIAL_RFV,
  PERMISSOES_ACESSO_COMERCIAL_COMISSIONAMENTO,
} from '../utils/comercialPermissoes.js';
import {
  getPainelComercialVendasAnalytics,
  getPainelComercialVendasDetalhe,
  getPainelComercialVendasDrill,
  getHistoricoVendasAnalytics,
  getHistoricoVendasDrill,
  getHistoricoVendasSerieFatia,
  getRfvClientesAnalytics,
  getComissionamentoAnalytics,
  getComissionamentoDrill,
  getComissionamentoDetalhe,
  getComissionamentoComparativo,
  getComissionamentoClassificacao,
  putComissionamentoClassificacao,
  getComissionamentoClientesInativos,
  getComissionamentoInativosWhatsapp,
  putComissionamentoInativosWhatsapp,
  postComissionamentoInativosWhatsapp,
} from '../controllers/comercialController.js';

const router = Router();
router.use(requireAuth);

const verPainelComercial = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_PAINEL);
const verHistoricoVendas = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS);
const verRfvClientes = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_RFV);
const verComissionamento = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_COMISSIONAMENTO);

router.get('/painel-vendas/analytics', verPainelComercial, getPainelComercialVendasAnalytics);
router.get('/painel-vendas/drill', verPainelComercial, getPainelComercialVendasDrill);
router.get('/painel-vendas/detalhe', verPainelComercial, getPainelComercialVendasDetalhe);

router.get('/historico-vendas/analytics', verHistoricoVendas, getHistoricoVendasAnalytics);
router.get('/historico-vendas/drill', verHistoricoVendas, getHistoricoVendasDrill);
router.get('/historico-vendas/serie-fatia', verHistoricoVendas, getHistoricoVendasSerieFatia);

router.get('/rfv/analytics', verRfvClientes, getRfvClientesAnalytics);

router.get('/comissionamento/analytics', verComissionamento, getComissionamentoAnalytics);
router.get('/comissionamento/drill', verComissionamento, getComissionamentoDrill);
router.get('/comissionamento/detalhe', verComissionamento, getComissionamentoDetalhe);
router.get('/comissionamento/comparativo', verComissionamento, getComissionamentoComparativo);
router.get('/comissionamento/clientes-inativos', verComissionamento, getComissionamentoClientesInativos);
router.get('/comissionamento/clientes-inativos/whatsapp', verComissionamento, getComissionamentoInativosWhatsapp);
router.put('/comissionamento/clientes-inativos/whatsapp', verComissionamento, putComissionamentoInativosWhatsapp);
router.post('/comissionamento/clientes-inativos/whatsapp', verComissionamento, postComissionamentoInativosWhatsapp);
router.get('/comissionamento/classificacao', verComissionamento, getComissionamentoClassificacao);
router.put('/comissionamento/classificacao', verComissionamento, putComissionamentoClassificacao);

export default router;
