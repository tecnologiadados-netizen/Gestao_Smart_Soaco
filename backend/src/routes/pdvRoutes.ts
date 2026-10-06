import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getClientes,
  getConsultaConfig,
  getEspera,
  getFormas,
  getOpcoesConfig,
  getProdutos,
  getSessao,
  getVenda,
  postAbrirCaixa,
  postCertificado,
  postFecharCaixa,
  postMovimento,
  postRetomar,
  postVenda,
  putEmpresaConfig,
  putFiscal,
  putVinculo,
  uploadPfx,
} from '../pdv/pdvController.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission(PERMISSOES.PDV_VER, PERMISSOES.PDV_CONFIGURAR));

router.get('/sessao', (req, res, next) => {
  getSessao(req, res).catch(next);
});
router.get('/produtos', (req, res, next) => {
  getProdutos(req, res).catch(next);
});
router.get('/clientes', (req, res, next) => {
  getClientes(req, res).catch(next);
});
router.get('/formas', (req, res, next) => {
  getFormas(req, res).catch(next);
});
router.post('/caixa/abrir', (req, res, next) => {
  postAbrirCaixa(req, res).catch(next);
});
router.post('/caixa/movimento', (req, res, next) => {
  postMovimento(req, res).catch(next);
});
router.post('/caixa/fechar', (req, res, next) => {
  postFecharCaixa(req, res).catch(next);
});
router.get('/vendas/espera', (req, res, next) => {
  getEspera(req, res).catch(next);
});
router.post('/vendas', (req, res, next) => {
  postVenda(req, res).catch(next);
});
router.post('/vendas/:id/retomar', (req, res, next) => {
  postRetomar(req, res).catch(next);
});
router.get('/vendas/:id', (req, res, next) => {
  getVenda(req, res).catch(next);
});

router.get('/config/opcoes', (req, res, next) => {
  getOpcoesConfig(req, res).catch(next);
});
router.get('/config/consulta', (req, res, next) => {
  getConsultaConfig(req, res).catch(next);
});
router.put('/config/empresas/:idEmpresa', (req, res, next) => {
  putEmpresaConfig(req, res).catch(next);
});
router.put('/config/usuarios/:usuarioId', (req, res, next) => {
  putVinculo(req, res).catch(next);
});
router.post('/config/empresas/:idEmpresa/certificado', uploadPfx.single('arquivo'), (req, res, next) => {
  postCertificado(req, res).catch(next);
});
router.put('/config/empresas/:idEmpresa/fiscal', (req, res, next) => {
  putFiscal(req, res).catch(next);
});

export default router;
