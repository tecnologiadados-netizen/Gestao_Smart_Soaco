import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  createMindMap,
  deleteMindMap,
  getMindMap,
  listMindMaps,
  updateMindMap,
} from '../controllers/mindMapsController.js';

const router = Router();
router.use(requireAuth);

/** Visualizar lista e mapas: fluxos.ver ou fluxos.editar */
const podeVerFluxos = requirePermission(PERMISSOES.FLUXOS_VER, PERMISSOES.FLUXOS_EDITAR);

router.get('/', podeVerFluxos, listMindMaps);
router.get('/:id', podeVerFluxos, getMindMap);
router.post('/', requirePermission(PERMISSOES.FLUXOS_EDITAR), validateCsrf, createMindMap);
router.put('/:id', requirePermission(PERMISSOES.FLUXOS_EDITAR), validateCsrf, updateMindMap);
router.delete('/:id', requirePermission(PERMISSOES.FLUXOS_EDITAR), validateCsrf, deleteMindMap);

export default router;
