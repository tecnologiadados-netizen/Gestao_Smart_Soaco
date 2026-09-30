import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { PERMISSOES_ACESSO_QUALIDADE } from '../utils/qualidadePermissoes.js';
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
router.use(requirePermission(...PERMISSOES_ACESSO_QUALIDADE));

const podeDocumentos = requirePermission(PERMISSOES.QUALIDADE_VER, PERMISSOES.QUALIDADE_DOCUMENTOS);
const podeCalibracoes = requirePermission(PERMISSOES.QUALIDADE_VER, PERMISSOES.QUALIDADE_CALIBRACOES);
const podeRegistros = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_REGISTROS,
  PERMISSOES.QUALIDADE_REGISTROS_RNC,
  PERMISSOES.QUALIDADE_REGISTROS_RCC,
  PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_FORNECEDOR
);
const podeRnc = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_REGISTROS,
  PERMISSOES.QUALIDADE_REGISTROS_RNC
);
const podeRcc = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_REGISTROS,
  PERMISSOES.QUALIDADE_REGISTROS_RCC
);
const podeAvaliacao = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_REGISTROS,
  PERMISSOES.QUALIDADE_REGISTROS_AVALIACAO_FORNECEDOR
);
const podeConfig = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  PERMISSOES.QUALIDADE_CONFIG_SETORES,
  PERMISSOES.QUALIDADE_CONFIG_CATEGORIAS,
  PERMISSOES.QUALIDADE_CONFIG_ENDERECAMENTO,
  PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES,
  PERMISSOES.QUALIDADE_CONFIG_CAUSAS,
  PERMISSOES.QUALIDADE_CONFIG_SERVICOS
);
const podeReclamacoes = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  PERMISSOES.QUALIDADE_CONFIG_RECLAMACOES
);
const podeCausas = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  PERMISSOES.QUALIDADE_CONFIG_CAUSAS
);
const podeServicos = requirePermission(
  PERMISSOES.QUALIDADE_VER,
  PERMISSOES.QUALIDADE_CONFIGURACOES,
  PERMISSOES.QUALIDADE_CONFIG_SERVICOS
);

router.get('/bootstrap', (req, res, next) => {
  getQualidadeBootstrapHandler(req, res).catch(next);
});
router.get('/responsaveis', (req, res, next) => {
  getQualidadeResponsaveisHandler(req, res).catch(next);
});
router.get('/organico-colaboradores', (req, res, next) => {
  getQualidadeOrganicoColaboradoresHandler(req, res).catch(next);
});

router.put('/sync/config', podeConfig, (req, res, next) => {
  putQualidadeConfigHandler(req, res).catch(next);
});
router.put('/sync/registros', podeRegistros, (req, res, next) => {
  putQualidadeRegistrosHandler(req, res).catch(next);
});
router.delete('/registros/:uid', podeRegistros, (req, res, next) => {
  deleteQualidadeRegistroHandler(req, res).catch(next);
});
router.put('/sync/documentos', podeDocumentos, (req, res, next) => {
  putQualidadeDocumentsHandler(req, res).catch(next);
});
router.delete('/documentos/:uid', podeDocumentos, (req, res, next) => {
  deleteQualidadeDocumentHandler(req, res).catch(next);
});
router.put('/sync/calibracoes', podeCalibracoes, (req, res, next) => {
  putQualidadeCalibrationsHandler(req, res).catch(next);
});
router.delete('/equipamentos/:uid', podeCalibracoes, (req, res, next) => {
  deleteQualidadeEquipamentoHandler(req, res).catch(next);
});
router.put('/sync/avaliacoes', podeAvaliacao, (req, res, next) => {
  putQualidadeAvaliacoesHandler(req, res).catch(next);
});
router.put('/sync/opcoes-lista', (req, res, next) => {
  putQualidadeOpcoesListaHandler(req, res).catch(next);
});
router.post('/registros/import', podeRegistros, (req, res, next) => {
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
router.post('/reclamacoes-produto', podeReclamacoes, (req, res, next) => {
  postQualidadeReclamacaoProduto(req, res).catch(next);
});
router.put('/reclamacoes-produto/:uid', podeReclamacoes, (req, res, next) => {
  putQualidadeReclamacaoProduto(req, res).catch(next);
});
router.delete('/reclamacoes-produto/:uid', podeReclamacoes, (req, res, next) => {
  deleteQualidadeReclamacaoProduto(req, res).catch(next);
});
router.get('/causas-problema', (req, res, next) => {
  getQualidadeCausasProblema(req, res).catch(next);
});
router.post('/causas-problema', podeCausas, (req, res, next) => {
  postQualidadeCausaProblema(req, res).catch(next);
});
router.put('/causas-problema/:uid', podeCausas, (req, res, next) => {
  putQualidadeCausaProblema(req, res).catch(next);
});
router.delete('/causas-problema/:uid', podeCausas, (req, res, next) => {
  deleteQualidadeCausaProblema(req, res).catch(next);
});
router.get('/servicos-realizados', (req, res, next) => {
  getQualidadeServicosRealizados(req, res).catch(next);
});
router.post('/servicos-realizados', podeServicos, (req, res, next) => {
  postQualidadeServicoRealizado(req, res).catch(next);
});
router.put('/servicos-realizados/:uid', podeServicos, (req, res, next) => {
  putQualidadeServicoRealizado(req, res).catch(next);
});
router.delete('/servicos-realizados/:uid', podeServicos, (req, res, next) => {
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
router.get('/rnc-painel', podeRnc, (req, res, next) => {
  getQualidadeRncPainel(req, res).catch(next);
});
router.post('/registros/rnc/pdf', podeRnc, (req, res, next) => {
  postQualidadeRncPdf(req, res).catch(next);
});
router.post('/registros/rcc/pdf', podeRcc, (req, res, next) => {
  postQualidadeRccPdf(req, res).catch(next);
});
router.get('/arquivos/preview', (req, res, next) => {
  getQualidadeArquivoPreviewHandler(req, res).catch(next);
});

export default router;
