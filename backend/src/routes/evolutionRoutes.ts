import { Router } from 'express';
import { getConnect, getConfig, saveConfig, logout } from '../controllers/evolutionController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { validateCsrf } from '../middleware/csrf.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSOES.USUARIOS_GERENCIAR));

router.get('/connect', getConnect);
router.get('/config', getConfig);
router.post('/save-config', validateCsrf, saveConfig);
router.post('/logout', validateCsrf, logout);

export default router;
