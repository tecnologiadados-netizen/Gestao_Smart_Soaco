import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS,
  PERMISSOES_ACESSO_COMERCIAL_RFV,
  PERMISSOES_ACESSO_COMERCIAL_COMISSIONAMENTO,
  PERMISSOES_ACESSO_COMERCIAL_PORTA_PALLETS,
} from '../utils/comercialPermissoes.js';
import { PERMISSOES_ACESSO_PAINEL_GRUPO_ECONOMICO } from '../utils/kpisPermissoes.js';
import {
  getGrupoEconomicoDetalhe,
  getGrupoEconomicoLista,
} from '../controllers/grupoEconomicoController.js';
import {
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
import {
  getPortaPalletsAuditoriaMensal,
  getPortaPalletsDadosAbertos,
  getPortaPalletsDetalhe,
  getPortaPalletsMensal,
  getPortaPalletsOpcoes,
} from '../controllers/portaPalletsComercialController.js';

const router = Router();
router.use(requireAuth);

const verHistoricoVendas = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS);
const verRfvClientes = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_RFV);
const verComissionamento = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_COMISSIONAMENTO);
const verPortaPallets = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_PORTA_PALLETS);
const verGrupoEconomico = requirePermission(...PERMISSOES_ACESSO_PAINEL_GRUPO_ECONOMICO);

router.get('/grupo-economico', verGrupoEconomico, getGrupoEconomicoLista);
router.get('/grupo-economico/:id', verGrupoEconomico, getGrupoEconomicoDetalhe);

router.get('/historico-vendas/analytics', verHistoricoVendas, getHistoricoVendasAnalytics);
router.get('/historico-vendas/drill', verHistoricoVendas, getHistoricoVendasDrill);
router.get('/historico-vendas/serie-fatia', verHistoricoVendas, getHistoricoVendasSerieFatia);

router.get('/rfv/analytics', verRfvClientes, getRfvClientesAnalytics);

router.get('/porta-pallets/opcoes', verPortaPallets, getPortaPalletsOpcoes);
router.get('/porta-pallets/mensal', verPortaPallets, getPortaPalletsMensal);
router.get('/porta-pallets/detalhe', verPortaPallets, getPortaPalletsDetalhe);
router.get('/porta-pallets/dados-abertos', verPortaPallets, getPortaPalletsDadosAbertos);
router.get('/porta-pallets/auditoria-mensal', verPortaPallets, getPortaPalletsAuditoriaMensal);

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
