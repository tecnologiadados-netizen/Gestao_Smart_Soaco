import { Router } from 'express';
import { getAiSettings, saveAiSettings, testAiSettings } from '../controllers/aiSettingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission(PERMISSOES.SISTEMA_AI, PERMISSOES.USUARIOS_GERENCIAR));

router.get('/', getAiSettings);
router.put('/', validateCsrf, saveAiSettings);
router.post('/test', validateCsrf, testAiSettings);

export default router;
