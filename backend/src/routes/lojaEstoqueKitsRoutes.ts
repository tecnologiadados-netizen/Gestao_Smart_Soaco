import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getLojaEstoqueKitsDocumentosSaidaNomus,
  getLojaEstoqueKitsInventarios,
  getLojaEstoqueKitsItensDocumentoSaidaNomus,
  getLojaEstoqueKitsMovimentacoes,
  getLojaEstoqueKitsResumo,
  postLojaEstoqueKitsInventario,
  postLojaEstoqueKitsMovimentacao,
} from '../controllers/lojaEstoqueKitsController.js';

const router = Router();
router.use(requireAuth);

const podeVer = requirePermission(
  PERMISSOES.LOJA_KITS_VER,
  PERMISSOES.LOJA_KITS_MOVIMENTAR,
  PERMISSOES.LOJA_KITS_INVENTARIO,
);

router.get('/resumo', podeVer, getLojaEstoqueKitsResumo);
router.get('/documentos-saida', podeVer, getLojaEstoqueKitsDocumentosSaidaNomus);
router.get('/documentos-saida/:documentoId/itens', podeVer, getLojaEstoqueKitsItensDocumentoSaidaNomus);
router.get('/movimentacoes', podeVer, getLojaEstoqueKitsMovimentacoes);
router.post(
  '/movimentacoes',
  validateCsrf,
  requirePermission(PERMISSOES.LOJA_KITS_MOVIMENTAR),
  postLojaEstoqueKitsMovimentacao,
);
router.get(
  '/inventarios',
  requirePermission(PERMISSOES.LOJA_KITS_INVENTARIO, PERMISSOES.LOJA_KITS_VER),
  getLojaEstoqueKitsInventarios,
);
router.post(
  '/inventarios',
  validateCsrf,
  requirePermission(PERMISSOES.LOJA_KITS_INVENTARIO),
  postLojaEstoqueKitsInventario,
);

export default router;
