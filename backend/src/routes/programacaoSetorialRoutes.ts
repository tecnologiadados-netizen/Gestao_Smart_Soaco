import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES_ACESSO_PROGRAMACAO_SETORIAL } from '../utils/programacaoSetorialPermissoes.js';
import {
  getProgramacaoSetorialPlanning,
  getProgramacaoSetorialEstoque,
  listarProgramacoesSetoriais,
  criarProgramacaoSetorial,
  atualizarProgramacaoSetorial,
} from '../controllers/programacaoSetorialController.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission(...PERMISSOES_ACESSO_PROGRAMACAO_SETORIAL));

router.get('/planning', getProgramacaoSetorialPlanning);
router.get('/estoque', getProgramacaoSetorialEstoque);
router.get('/registros', listarProgramacoesSetoriais);
router.post('/registros', validateCsrf, criarProgramacaoSetorial);
router.patch('/registros/:id', validateCsrf, atualizarProgramacaoSetorial);

export default router;
