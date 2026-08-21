import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  PERMISSOES_ACESSO_COMERCIAL_PAINEL,
  PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS,
  PERMISSOES_ACESSO_COMERCIAL_RFV,
} from '../utils/comercialPermissoes.js';
import {
  getPainelComercialVendasAnalytics,
  getPainelComercialVendasDetalhe,
  getPainelComercialVendasDrill,
  getHistoricoVendasAnalytics,
  getHistoricoVendasDrill,
  getHistoricoVendasSerieFatia,
  getRfvClientesAnalytics,
} from '../controllers/comercialController.js';

const router = Router();
router.use(requireAuth);

const verPainelComercial = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_PAINEL);
const verHistoricoVendas = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_HISTORICO_VENDAS);
const verRfvClientes = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_RFV);

router.get('/painel-vendas/analytics', verPainelComercial, getPainelComercialVendasAnalytics);
router.get('/painel-vendas/drill', verPainelComercial, getPainelComercialVendasDrill);
router.get('/painel-vendas/detalhe', verPainelComercial, getPainelComercialVendasDetalhe);

router.get('/historico-vendas/analytics', verHistoricoVendas, getHistoricoVendasAnalytics);
router.get('/historico-vendas/drill', verHistoricoVendas, getHistoricoVendasDrill);
router.get('/historico-vendas/serie-fatia', verHistoricoVendas, getHistoricoVendasSerieFatia);

router.get('/rfv/analytics', verRfvClientes, getRfvClientesAnalytics);

export default router;
