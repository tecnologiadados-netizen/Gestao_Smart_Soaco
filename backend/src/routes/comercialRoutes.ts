import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES_ACESSO_COMERCIAL_PAINEL } from '../utils/comercialPermissoes.js';
import {
  getPainelComercialVendasAnalytics,
  getPainelComercialVendasDetalhe,
  getPainelComercialVendasDrill,
} from '../controllers/comercialController.js';

const router = Router();
router.use(requireAuth);

const verPainelComercial = requirePermission(...PERMISSOES_ACESSO_COMERCIAL_PAINEL);

router.get('/painel-vendas/analytics', verPainelComercial, getPainelComercialVendasAnalytics);
router.get('/painel-vendas/drill', verPainelComercial, getPainelComercialVendasDrill);
router.get('/painel-vendas/detalhe', verPainelComercial, getPainelComercialVendasDetalhe);

export default router;

