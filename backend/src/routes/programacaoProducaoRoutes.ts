import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  createProgramacaoProducao,
  deleteProgramacaoProducao,
  getBobinasProgramacaoProducaoBusca,
  getBobinasProgramacaoProducaoPorCodigos,
  getEstoqueBobinaSetores,
  getEstoqueComponenteDetalhe,
  getProgramacaoProducao,
  getProgramacaoProducaoCatalogo,
  getProgramacaoProducaoGrade,
  getOrdensNomusProgramacaoProducao,
  putProgramacaoProducaoCatalogoBobinas,
  putProgramacaoProducaoCatalogoDescricao,
  putProgramacaoProducaoCatalogoMedidasPeca,
  getProgramacaoProducaoRecursos,
  postProgramacaoProducaoRecurso,
  putProgramacaoProducaoRecurso,
  deleteProgramacaoProducaoRecursoHandler,
  listProgramacoesProducao,
  patchProgramacaoProducaoConcluir,
  patchProgramacaoProducaoProcessar,
  updateProgramacaoProducao,
} from '../controllers/programacaoProducaoController.js';

const router = Router();
router.use(requireAuth);

const PERMS_PCP = [
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PEDIDOS_VER,
] as const;

const podeVer = requirePermission(...PERMS_PCP);

router.get('/', podeVer, listProgramacoesProducao);
router.get('/grade', podeVer, getProgramacaoProducaoGrade);
router.get('/catalogo', podeVer, getProgramacaoProducaoCatalogo);
router.put('/catalogo/descricao', podeVer, validateCsrf, putProgramacaoProducaoCatalogoDescricao);
router.put('/catalogo/bobinas', podeVer, validateCsrf, putProgramacaoProducaoCatalogoBobinas);
router.put('/catalogo/medidas-peca', podeVer, validateCsrf, putProgramacaoProducaoCatalogoMedidasPeca);
router.get('/recursos', podeVer, getProgramacaoProducaoRecursos);
router.post('/recursos', podeVer, validateCsrf, postProgramacaoProducaoRecurso);
router.put('/recursos/:cod', podeVer, validateCsrf, putProgramacaoProducaoRecurso);
router.delete('/recursos/:cod', podeVer, validateCsrf, deleteProgramacaoProducaoRecursoHandler);
router.get('/ordens-nomus', podeVer, getOrdensNomusProgramacaoProducao);
router.get('/bobinas-busca', podeVer, getBobinasProgramacaoProducaoBusca);
router.get('/bobinas-por-codigos', podeVer, getBobinasProgramacaoProducaoPorCodigos);
router.get('/estoque-bobina/:idBobina', podeVer, getEstoqueBobinaSetores);
router.get('/estoque-componente/:idComponente', podeVer, getEstoqueComponenteDetalhe);
router.patch('/:id/processar', podeVer, validateCsrf, patchProgramacaoProducaoProcessar);
router.patch('/:id/concluir', podeVer, validateCsrf, patchProgramacaoProducaoConcluir);
router.get('/:id', podeVer, getProgramacaoProducao);
router.post('/', podeVer, validateCsrf, createProgramacaoProducao);
router.put('/:id', podeVer, validateCsrf, updateProgramacaoProducao);
router.delete('/:id', podeVer, validateCsrf, deleteProgramacaoProducao);

export default router;
