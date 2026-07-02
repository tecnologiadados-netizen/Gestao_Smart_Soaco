import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getStatus } from '../controllers/statusController.js';

const router = Router();
router.use(requireAuth);
router.get('/', getStatus);

export default router;
