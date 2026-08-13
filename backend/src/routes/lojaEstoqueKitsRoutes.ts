import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getLojaEstoqueKitsDocumentosSaidaNomus,
  getLojaEstoqueKitsInventarios,
  getLojaEstoqueKitsItensDocumentoSaidaNomus,
  getLojaEstoqueKitsItensSequenciaShop9,
  getLojaEstoqueKitsMovimentacoes,
  getLojaEstoqueKitsResumo,
  getLojaEstoqueKitsSequenciasShop9,
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
router.get('/sequencias-shop9', podeVer, getLojaEstoqueKitsSequenciasShop9);
router.get('/sequencias-shop9/:ordem/itens', podeVer, getLojaEstoqueKitsItensSequenciaShop9);
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
