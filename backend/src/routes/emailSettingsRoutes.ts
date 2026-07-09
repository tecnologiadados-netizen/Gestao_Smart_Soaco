import { Router } from 'express';
import {
  dispatchEmail,
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
} from '../controllers/emailSettingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';

const router = Router();

router.use(requireAuth);
router.use(
  requirePermission(PERMISSOES.SISTEMA_EMAIL, PERMISSOES.USUARIOS_GERENCIAR)
);

router.get('/', getEmailSettings);
router.post('/', validateCsrf, saveEmailSettings);
router.post('/test', validateCsrf, sendTestEmail);
router.post('/dispatch', validateCsrf, dispatchEmail);

export default router;
