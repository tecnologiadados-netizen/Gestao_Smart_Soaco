import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getMpp, getMppExport } from '../controllers/mppController.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission(PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER));

const exportarMppXlsx = requirePermission(
  PERMISSOES.PCP_EXPORTAR_XLSX,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PEDIDOS_EDITAR
);

router.get('/export', exportarMppXlsx, getMppExport);
router.get('/', getMpp);

export default router;
