import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  listarGrupos,
  listarPermissoes,
  criarGrupo,
  atualizarGrupo,
  excluirGrupo,
  obterRhPermissoesContexto,
  obterRhPermissoesGrupo,
} from '../controllers/gruposController.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission(PERMISSOES.GRUPOS_TELA_VER, PERMISSOES.USUARIOS_TELA_VER, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR),
  listarGrupos
);
router.get(
  '/permissoes',
  requirePermission(PERMISSOES.GRUPOS_TELA_VER, PERMISSOES.USUARIOS_TELA_VER, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR),
  listarPermissoes
);
router.get(
  '/rh-permissoes-contexto',
  requirePermission(PERMISSOES.GRUPOS_TELA_VER, PERMISSOES.GRUPOS_EDITAR, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR, PERMISSOES.RH_CONFIGURAR),
  obterRhPermissoesContexto
);
router.get(
  '/:id/rh-permissoes',
  requirePermission(PERMISSOES.GRUPOS_TELA_VER, PERMISSOES.GRUPOS_EDITAR, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR, PERMISSOES.RH_CONFIGURAR),
  obterRhPermissoesGrupo
);
router.post(
  '/',
  validateCsrf,
  requirePermission(PERMISSOES.GRUPOS_CRIAR, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR),
  criarGrupo
);
// PUT é por ação (permissoes/nome/ativo) e validação granular acontece no controller.
router.put('/:id', validateCsrf, atualizarGrupo);
router.delete(
  '/:id',
  validateCsrf,
  requirePermission(PERMISSOES.GRUPOS_EXCLUIR, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR),
  excluirGrupo
);

export default router;
