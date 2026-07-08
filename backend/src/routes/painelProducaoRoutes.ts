import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getPainelProducaoDashboard,
  getPainelProducaoFilters,
  getPainelProducaoTargets,
  postPainelProducaoMes,
  postPainelProducaoTarget,
} from '../controllers/painelProducaoController.js';

const router = Router();
router.use(requireAuth);

const podeEditarMetas = requirePermission(
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeVerFiltros = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeVerDashboard = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_TOTAL,
);
const podeVerTargets = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);

router.get('/filters', podeVerFiltros, getPainelProducaoFilters);
router.get('/dashboard', podeVerDashboard, getPainelProducaoDashboard);
router.get('/targets', podeVerTargets, getPainelProducaoTargets);
router.post('/targets', validateCsrf, podeEditarMetas, postPainelProducaoTarget);
router.post('/meses', validateCsrf, podeEditarMetas, postPainelProducaoMes);

export default router;
