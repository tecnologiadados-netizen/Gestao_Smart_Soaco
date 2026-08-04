import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getPainelProducaoApuracao,
  getPainelProducaoApuracaoDetalhe,
  getPainelProducaoDashboard,
  getPainelProducaoFaixasDesconto,
  getPainelProducaoFilters,
  getPainelProducaoTargets,
  postPainelProducaoMes,
  postPainelProducaoTarget,
  putPainelProducaoFaixasDesconto,
  putPainelProducaoSetorPenalizacao,
} from '../controllers/painelProducaoController.js';

const router = Router();
router.use(requireAuth);

const podeEditarMetas = requirePermission(
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeEditarFaixas = requirePermission(
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeVerFiltros = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_PAINEL_APURACAO_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeVerDashboard = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_TOTAL,
);
const podeVerApuracao = requirePermission(
  PERMISSOES.PCP_PAINEL_APURACAO_VER,
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_TOTAL,
);
const podeVerTargets = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);

router.get('/filters', podeVerFiltros, getPainelProducaoFilters);
router.get('/dashboard', podeVerDashboard, getPainelProducaoDashboard);
router.get('/apuracao', podeVerApuracao, getPainelProducaoApuracao);
router.get('/apuracao/detalhe', podeVerApuracao, getPainelProducaoApuracaoDetalhe);
router.get('/targets', podeVerTargets, getPainelProducaoTargets);
router.post('/targets', validateCsrf, podeEditarMetas, postPainelProducaoTarget);
router.get('/faixas-desconto', podeVerTargets, getPainelProducaoFaixasDesconto);
router.put('/faixas-desconto', validateCsrf, podeEditarFaixas, putPainelProducaoFaixasDesconto);
router.put('/setor-penalizacao', validateCsrf, podeEditarMetas, putPainelProducaoSetorPenalizacao);
router.post('/meses', validateCsrf, podeEditarMetas, postPainelProducaoMes);

export default router;
