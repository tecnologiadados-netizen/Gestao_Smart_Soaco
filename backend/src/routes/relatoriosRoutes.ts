import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getRelatorioAlteracoes } from '../controllers/relatoriosController.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission(PERMISSOES.RELATORIOS_VER));

router.get('/alteracoes', getRelatorioAlteracoes);

export default router;
