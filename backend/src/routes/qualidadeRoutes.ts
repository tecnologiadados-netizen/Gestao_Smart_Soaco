import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getQualidadeClientes,
  getQualidadeFornecedores,
  getQualidadeProdutos,
  postQualidadeRccPdf,
  postQualidadeRncPdf,
  postQualidadeEmbedSession,
} from '../controllers/qualidadeController.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission(PERMISSOES.QUALIDADE_VER));

router.post('/embed-session', (req, res, next) => {
  postQualidadeEmbedSession(req, res).catch(next);
});
router.get('/clientes', (req, res, next) => {
  getQualidadeClientes(req, res).catch(next);
});
router.get('/produtos', (req, res, next) => {
  getQualidadeProdutos(req, res).catch(next);
});
router.get('/fornecedores', (req, res, next) => {
  getQualidadeFornecedores(req, res).catch(next);
});
router.post('/registros/rnc/pdf', (req, res, next) => {
  postQualidadeRncPdf(req, res).catch(next);
});
router.post('/registros/rcc/pdf', (req, res, next) => {
  postQualidadeRccPdf(req, res).catch(next);
});

export default router;
