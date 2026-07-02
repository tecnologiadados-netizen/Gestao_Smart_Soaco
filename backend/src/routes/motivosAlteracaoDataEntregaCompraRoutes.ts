import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireMasterOrAdmin } from '../middleware/requireMasterOrAdmin.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getMotivosAlteracaoDataEntregaCompra,
  postMotivoAlteracaoDataEntregaCompra,
  putMotivoAlteracaoDataEntregaCompra,
  deleteMotivoAlteracaoDataEntregaCompra,
} from '../controllers/motivosAlteracaoDataEntregaCompraController.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission(PERMISSOES.INTEGRACAO_VER), getMotivosAlteracaoDataEntregaCompra);
router.post('/', validateCsrf, requireMasterOrAdmin, postMotivoAlteracaoDataEntregaCompra);
router.put('/:id', validateCsrf, requireMasterOrAdmin, putMotivoAlteracaoDataEntregaCompra);
router.delete('/:id', validateCsrf, requireMasterOrAdmin, deleteMotivoAlteracaoDataEntregaCompra);

export default router;
