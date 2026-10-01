import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getQualidadeBootstrapHandler,
  getQualidadeClientes,
  getQualidadeDocumentosEntrada,
  getQualidadeFornecedores,
  getQualidadeItensPedidoVenda,
  getQualidadeNotasFiscaisPedidoVenda,
  getQualidadePedidosVenda,
  getQualidadePessoas,
  getQualidadeProdutos,
  getQualidadeReclamacoesProduto,
  getQualidadeRncPainel,
  getQualidadeSetorProducaoProduto,
  postQualidadeReclamacaoProduto,
  putQualidadeReclamacaoProduto,
  deleteQualidadeReclamacaoProduto,
  getQualidadeCausasProblema,
  postQualidadeCausaProblema,
  putQualidadeCausaProblema,
  deleteQualidadeCausaProblema,
  getQualidadeServicosRealizados,
  postQualidadeServicoRealizado,
  putQualidadeServicoRealizado,
  deleteQualidadeServicoRealizado,
  getQualidadeOrganicoColaboradoresHandler,
  getQualidadeResponsaveisHandler,
  postQualidadeRccPdf,
  postQualidadeAlertaCadastroCliente,
  postQualidadeRegistrosImportHandler,
  getQualidadeArquivoPreviewHandler,
  postQualidadeRncPdf,
  putQualidadeAvaliacoesHandler,
  putQualidadeCalibrationsHandler,
  putQualidadeConfigHandler,
  putQualidadeDocumentsHandler,
  deleteQualidadeDocumentHandler,
  deleteQualidadeEquipamentoHandler,
  putQualidadeOpcoesListaHandler,
  putQualidadeRegistrosHandler,
  deleteQualidadeRegistroHandler,
} from '../controllers/qualidadeController.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission(PERMISSOES.QUALIDADE_VER));

router.get('/bootstrap', (req, res, next) => {
  getQualidadeBootstrapHandler(req, res).catch(next);
});
router.get('/responsaveis', (req, res, next) => {
  getQualidadeResponsaveisHandler(req, res).catch(next);
});
router.get('/organico-colaboradores', (req, res, next) => {
  getQualidadeOrganicoColaboradoresHandler(req, res).catch(next);
});

router.put('/sync/config', (req, res, next) => {
  putQualidadeConfigHandler(req, res).catch(next);
});
router.put('/sync/registros', (req, res, next) => {
  putQualidadeRegistrosHandler(req, res).catch(next);
});
router.post('/rcc/alerta-cadastro-cliente', (req, res, next) => {
  postQualidadeAlertaCadastroCliente(req, res).catch(next);
});
router.delete('/registros/:uid', (req, res, next) => {
  deleteQualidadeRegistroHandler(req, res).catch(next);
});
router.put('/sync/documentos', (req, res, next) => {
  putQualidadeDocumentsHandler(req, res).catch(next);
});
router.delete('/documentos/:uid', (req, res, next) => {
  deleteQualidadeDocumentHandler(req, res).catch(next);
});
router.put('/sync/calibracoes', (req, res, next) => {
  putQualidadeCalibrationsHandler(req, res).catch(next);
});
router.delete('/equipamentos/:uid', (req, res, next) => {
  deleteQualidadeEquipamentoHandler(req, res).catch(next);
});
router.put('/sync/avaliacoes', (req, res, next) => {
  putQualidadeAvaliacoesHandler(req, res).catch(next);
});
router.put('/sync/opcoes-lista', (req, res, next) => {
  putQualidadeOpcoesListaHandler(req, res).catch(next);
});
router.post('/registros/import', (req, res, next) => {
  postQualidadeRegistrosImportHandler(req, res).catch(next);
});

router.get('/clientes', (req, res, next) => {
  getQualidadeClientes(req, res).catch(next);
});
router.get('/produtos', (req, res, next) => {
  getQualidadeProdutos(req, res).catch(next);
});
router.get('/produtos/setor-producao', (req, res, next) => {
  getQualidadeSetorProducaoProduto(req, res).catch(next);
});
router.get('/reclamacoes-produto', (req, res, next) => {
  getQualidadeReclamacoesProduto(req, res).catch(next);
});
router.post('/reclamacoes-produto', (req, res, next) => {
  postQualidadeReclamacaoProduto(req, res).catch(next);
});
router.put('/reclamacoes-produto/:uid', (req, res, next) => {
  putQualidadeReclamacaoProduto(req, res).catch(next);
});
router.delete('/reclamacoes-produto/:uid', (req, res, next) => {
  deleteQualidadeReclamacaoProduto(req, res).catch(next);
});
router.get('/causas-problema', (req, res, next) => {
  getQualidadeCausasProblema(req, res).catch(next);
});
router.post('/causas-problema', (req, res, next) => {
  postQualidadeCausaProblema(req, res).catch(next);
});
router.put('/causas-problema/:uid', (req, res, next) => {
  putQualidadeCausaProblema(req, res).catch(next);
});
router.delete('/causas-problema/:uid', (req, res, next) => {
  deleteQualidadeCausaProblema(req, res).catch(next);
});
router.get('/servicos-realizados', (req, res, next) => {
  getQualidadeServicosRealizados(req, res).catch(next);
});
router.post('/servicos-realizados', (req, res, next) => {
  postQualidadeServicoRealizado(req, res).catch(next);
});
router.put('/servicos-realizados/:uid', (req, res, next) => {
  putQualidadeServicoRealizado(req, res).catch(next);
});
router.delete('/servicos-realizados/:uid', (req, res, next) => {
  deleteQualidadeServicoRealizado(req, res).catch(next);
});
router.get('/fornecedores', (req, res, next) => {
  getQualidadeFornecedores(req, res).catch(next);
});
router.get('/pessoas', (req, res, next) => {
  getQualidadePessoas(req, res).catch(next);
});
router.get('/documentos-entrada', (req, res, next) => {
  getQualidadeDocumentosEntrada(req, res).catch(next);
});
router.get('/pedidos-venda', (req, res, next) => {
  getQualidadePedidosVenda(req, res).catch(next);
});
router.get('/pedidos-venda/:pedidoId/itens', (req, res, next) => {
  getQualidadeItensPedidoVenda(req, res).catch(next);
});
router.get('/pedidos-venda/:pedidoId/notas-fiscais', (req, res, next) => {
  getQualidadeNotasFiscaisPedidoVenda(req, res).catch(next);
});
router.get('/rnc-painel', (req, res, next) => {
  getQualidadeRncPainel(req, res).catch(next);
});
router.post('/registros/rnc/pdf', (req, res, next) => {
  postQualidadeRncPdf(req, res).catch(next);
});
router.post('/registros/rcc/pdf', (req, res, next) => {
  postQualidadeRccPdf(req, res).catch(next);
});
router.get('/arquivos/preview', (req, res, next) => {
  getQualidadeArquivoPreviewHandler(req, res).catch(next);
});

export default router;
