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
  getPainelProducaoAlcancado,
  getPainelProducaoFilters,
  getPainelProducaoOrganicoColaboradores,
  getPainelProducaoOrganicoFoto,
  getPainelProducaoResponsaveis,
  getPainelProducaoTargets,
  postPainelProducaoMes,
  postPainelProducaoTarget,
  putPainelProducaoFaixasDesconto,
  putPainelProducaoResponsaveis,
  putPainelProducaoSetorPenalizacao,
  getPainelFaturamento,
  getPainelFaturamentoDia,
  getPainelFaturamentoLinhas,
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
  PERMISSOES.PCP_PAINEL_FATURAMENTO_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
);
const podeVerDashboard = requirePermission(
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_TOTAL,
);
const podeVerFaturamento = requirePermission(
  PERMISSOES.PCP_PAINEL_FATURAMENTO_VER,
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
router.get('/faturamento', podeVerFaturamento, getPainelFaturamento);
router.get('/faturamento/linhas', podeVerFaturamento, getPainelFaturamentoLinhas);
router.get('/faturamento/dia', podeVerFaturamento, getPainelFaturamentoDia);
router.get('/apuracao', podeVerApuracao, getPainelProducaoApuracao);
router.get('/apuracao/detalhe', podeVerApuracao, getPainelProducaoApuracaoDetalhe);
router.get('/targets', podeVerTargets, getPainelProducaoTargets);
router.get('/targets/alcancado', podeVerTargets, getPainelProducaoAlcancado);
router.post('/targets', validateCsrf, podeEditarMetas, postPainelProducaoTarget);
router.get('/faixas-desconto', podeVerTargets, getPainelProducaoFaixasDesconto);
router.put('/faixas-desconto', validateCsrf, podeEditarFaixas, putPainelProducaoFaixasDesconto);
router.put('/setor-penalizacao', validateCsrf, podeEditarMetas, putPainelProducaoSetorPenalizacao);
router.post('/meses', validateCsrf, podeEditarMetas, postPainelProducaoMes);
router.get('/responsaveis', podeVerFiltros, getPainelProducaoResponsaveis);
router.put('/responsaveis', validateCsrf, podeEditarMetas, putPainelProducaoResponsaveis);
router.get('/organico-colaboradores', podeEditarMetas, getPainelProducaoOrganicoColaboradores);
router.get('/organico-foto/:organicoId', podeVerFiltros, getPainelProducaoOrganicoFoto);

export default router;
