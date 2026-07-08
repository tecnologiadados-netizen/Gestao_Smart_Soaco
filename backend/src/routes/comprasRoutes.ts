import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import { getProdutosColeta, getRessupAlmoxRegistroPreview, getRessupAlmoxPcPendDetalhes, getRessupEmpenhoDetalhes, getRessupEmpenhoPorPedido, getOpcoesFiltroRessupAlmox, getBuscarOpcoesFiltroRessupAlmox, postOpcoesFiltroCascataRessupAlmox, postRessupAlmoxAnalise, putRessupAlmoxAnalise, patchRessupAlmoxAnaliseProcessar, patchRessupAlmoxAnaliseConcluir, getRessupAlmoxAnalises, getRessupAlmoxAnaliseById, getRessupNaoAlmoxRegistroPreview, getRessupNaoAlmoxPcPendDetalhes, getOpcoesFiltroRessupNaoAlmox, getBuscarOpcoesFiltroRessupNaoAlmox, postOpcoesFiltroCascataRessupNaoAlmox, getRessupNaoAlmoxEstoque, getRessupNaoAlmoxCatalogo, putRessupNaoAlmoxCatalogoDescricao, putRessupNaoAlmoxCatalogoFundivel, postRessupNaoAlmoxAnalise, putRessupNaoAlmoxAnalise, patchRessupNaoAlmoxAnaliseProcessar, patchRessupNaoAlmoxAnaliseConcluir, getRessupNaoAlmoxAnalises, getRessupNaoAlmoxAnaliseById, getColetasPrecos, getColetasPrecosDebug, getOpcoesFiltroColetas, getOpcoesVinculoFinalizacao, getOpcoesVinculoErroOperacional, getDashboardErrosVinculoOperacional, getColetasBloqueantes, postCienciaColeta, postConfirmarColeta, getFornecedores, getCondicoesPagamento, getFormasPagamento, putColetaFornecedores, getPrecosColeta, getPrecosCotacao, postPrecosCotacao, patchObservacoesColeta, patchEnviarAprovacao, patchCancelarCotacao, patchReabrirColeta, patchFinalizarCotacao, patchRegistroQtdeAprovada, patchEnviarFinanceiro, deleteColetaPrecos, deleteColetaItem, deleteColetaTodosItens, postColetaItens, getPendenciasComprasOpcoesComprador, getPendenciasComprasConsultar, putPendenciasComprasPrioridadeFixa, deletePendenciasComprasPrioridadeFixa } from '../controllers/comprasController.js';
import { getPreCompraCotacoes, getPreCompraSugestoes, getPreCompraFornecedores, getPreCompraContatos, getPreCompraPdf } from '../controllers/preCompraController.js';

const router = Router();
router.use(requireAuth);

/** Envolve handler async para nunca deixar rejeição sem resposta (evita 500). */
function async503(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      const cause = err instanceof Error ? err.message : String(err);
      console.error('[comprasRoutes]', cause, err instanceof Error ? err.stack : '');
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Serviço temporariamente indisponível. Tente novamente.',
          cause,
        });
      }
    });
  };
}

router.get(
  '/produtos-coleta',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getProdutosColeta)
);

router.get(
  '/ressup-almox/registro-preview',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupAlmoxRegistroPreview)
);

router.get(
  '/ressup-almox/pc-pend-detalhes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupAlmoxPcPendDetalhes)
);

router.get(
  '/ressup/empenho-detalhes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupEmpenhoDetalhes)
);

router.get(
  '/ressup/empenho-por-pedido',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupEmpenhoPorPedido)
);

router.get(
  '/ressup-almox/opcoes-filtro',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getOpcoesFiltroRessupAlmox)
);

router.get(
  '/ressup-almox/opcoes-filtro/buscar',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getBuscarOpcoesFiltroRessupAlmox)
);

router.post(
  '/ressup-almox/opcoes-filtro/cascata',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(postOpcoesFiltroCascataRessupAlmox)
);

router.post(
  '/ressup-almox/analises',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(postRessupAlmoxAnalise)
);
router.get(
  '/ressup-almox/analises',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupAlmoxAnalises)
);
router.get(
  '/ressup-almox/analises/:id',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupAlmoxAnaliseById)
);
router.put(
  '/ressup-almox/analises/:id',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(putRessupAlmoxAnalise)
);
router.patch(
  '/ressup-almox/analises/:id/processar',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(patchRessupAlmoxAnaliseProcessar)
);
router.patch(
  '/ressup-almox/analises/:id/concluir',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(patchRessupAlmoxAnaliseConcluir)
);

router.get(
  '/ressup-nao-almox/registro-preview',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxRegistroPreview)
);

router.get(
  '/ressup-nao-almox/pc-pend-detalhes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxPcPendDetalhes)
);

router.get(
  '/ressup-nao-almox/opcoes-filtro',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getOpcoesFiltroRessupNaoAlmox)
);

router.get(
  '/ressup-nao-almox/opcoes-filtro/buscar',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getBuscarOpcoesFiltroRessupNaoAlmox)
);

router.post(
  '/ressup-nao-almox/opcoes-filtro/cascata',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(postOpcoesFiltroCascataRessupNaoAlmox)
);

router.get(
  '/ressup-nao-almox/estoque',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxEstoque)
);

router.get(
  '/ressup-nao-almox/catalogo',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxCatalogo)
);

router.put(
  '/ressup-nao-almox/catalogo/descricao',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(putRessupNaoAlmoxCatalogoDescricao)
);

router.put(
  '/ressup-nao-almox/catalogo/fundivel',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(putRessupNaoAlmoxCatalogoFundivel)
);

router.post(
  '/ressup-nao-almox/analises',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(postRessupNaoAlmoxAnalise)
);
router.get(
  '/ressup-nao-almox/analises',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxAnalises)
);
router.get(
  '/ressup-nao-almox/analises/:id',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getRessupNaoAlmoxAnaliseById)
);
router.put(
  '/ressup-nao-almox/analises/:id',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(putRessupNaoAlmoxAnalise)
);
router.patch(
  '/ressup-nao-almox/analises/:id/processar',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(patchRessupNaoAlmoxAnaliseProcessar)
);
router.patch(
  '/ressup-nao-almox/analises/:id/concluir',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(patchRessupNaoAlmoxAnaliseConcluir)
);

router.get(
  '/coletas/opcoes-filtro',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getOpcoesFiltroColetas)
);
router.get(
  '/coletas/opcoes-vinculo-finalizacao',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getOpcoesVinculoFinalizacao)
);
router.get(
  '/coletas/opcoes-vinculo-erro-operacional',
  requirePermission(PERMISSOES.COMPRAS_VINCULO_FINALIZACAO_AMPLIADO),
  async503(getOpcoesVinculoErroOperacional)
);
router.get(
  '/coletas/debug',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getColetasPrecosDebug)
);
router.get(
  '/coletas',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getColetasPrecos)
);

router.get(
  '/dashboard/erros-vinculo-operacional',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getDashboardErrosVinculoOperacional)
);

router.get(
  '/coletas-bloqueantes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getColetasBloqueantes)
);

router.post(
  '/coletas/:id/ciencia',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(postCienciaColeta)
);

router.post(
  '/confirmar-coleta',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(postConfirmarColeta)
);

router.get(
  '/fornecedores',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getFornecedores)
);

router.get(
  '/condicoes-pagamento',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getCondicoesPagamento)
);

router.get(
  '/formas-pagamento',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getFormasPagamento)
);

router.delete(
  '/coletas/:id',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(deleteColetaPrecos)
);

router.put(
  '/coletas/:id/fornecedores',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(putColetaFornecedores)
);

router.get(
  '/coletas/:id/precos',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPrecosColeta)
);

router.get(
  '/coletas/:id/precos-cotacao',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPrecosCotacao)
);

router.post(
  '/coletas/:id/precos-cotacao',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(postPrecosCotacao)
);

router.patch(
  '/coletas/:id/observacoes',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchObservacoesColeta)
);

router.patch(
  '/coletas/:id/enviar-aprovacao',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchEnviarAprovacao)
);

router.patch(
  '/coletas/:id/cancelar-cotacao',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchCancelarCotacao)
);

router.patch(
  '/coletas/:id/reabrir',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchReabrirColeta)
);

router.patch(
  '/coletas/:id/finalizar-cotacao',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchFinalizarCotacao)
);

router.patch(
  '/coletas/:id/registros/:registroId',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchRegistroQtdeAprovada)
);

router.patch(
  '/coletas/:id/enviar-financeiro',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(patchEnviarFinanceiro)
);

router.delete(
  '/coletas/:id/itens/todos',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(deleteColetaTodosItens)
);

router.delete(
  '/coletas/:id/itens/:idProduto',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(deleteColetaItem)
);

router.post(
  '/coletas/:id/itens',
  requirePermission(PERMISSOES.COMPRAS_EDITAR),
  async503(postColetaItens)
);

router.get(
  '/pre-compra/cotacoes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPreCompraCotacoes)
);

router.get(
  '/pre-compra/sugestoes',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPreCompraSugestoes)
);

router.get(
  '/pre-compra/cotacoes/:nome/fornecedores',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPreCompraFornecedores)
);

router.get(
  '/pre-compra/cotacoes/:nome/contatos',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPreCompraContatos)
);

router.get(
  '/pre-compra/cotacoes/:nome/pdf',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPreCompraPdf)
);

router.get(
  '/rotina/pendencias/opcoes-comprador',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPendenciasComprasOpcoesComprador)
);

router.get(
  '/rotina/pendencias/consultar',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(getPendenciasComprasConsultar)
);

router.put(
  '/rotina/pendencias/prioridade-fixa',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(putPendenciasComprasPrioridadeFixa)
);

router.delete(
  '/rotina/pendencias/prioridade-fixa',
  requirePermission(PERMISSOES.COMPRAS_VER),
  async503(deletePendenciasComprasPrioridadeFixa)
);

export default router;
