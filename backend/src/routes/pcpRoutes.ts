import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getCotacaoDetalheConsultaEstoque,
  getBuscarOpcoesFiltro,
  getBuscarPedidosGerenciadorTypeahead,
  getOpcoesFiltroConsultaEstoque,
  postOpcoesFiltroCascata,
  getPcDetalheConsultaEstoque,
  getSaldoDetalheConsultaEstoque,
  getScDetalheConsultaEstoque,
  postConsultarEstoque,
} from '../controllers/consultaEstoqueController.js';
import {
  getRegrasDataEntrega,
  postRegraDataEntregaVersao,
} from '../controllers/regrasDataEntregaController.js';

const router = Router();
router.use(requireAuth);

const podeConsultaEstoque = requirePermission(PERMISSOES.PCP_CONSULTA_ESTOQUE_VER);

const podeVerRegrasEntrega = requirePermission(
  PERMISSOES.PCP_REGRAS_ENTREGA_VER,
  PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR,
  PERMISSOES.PCP_TOTAL
);
const podeEditarRegrasEntrega = requirePermission(
  PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR,
  PERMISSOES.PCP_TOTAL
);

function async503(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      const cause = err instanceof Error ? err.message : String(err);
      console.error('[pcpRoutes]', cause, err instanceof Error ? err.stack : '');
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
  '/consulta-estoque/opcoes-filtro',
  podeConsultaEstoque,
  async503(getOpcoesFiltroConsultaEstoque)
);
router.post(
  '/consulta-estoque/opcoes-filtro/cascata',
  podeConsultaEstoque,
  async503(postOpcoesFiltroCascata)
);
router.get(
  '/consulta-estoque/opcoes-filtro/buscar',
  podeConsultaEstoque,
  async503(getBuscarOpcoesFiltro)
);
router.get(
  '/consulta-estoque/opcoes-filtro/pedidos',
  podeConsultaEstoque,
  async503(getBuscarPedidosGerenciadorTypeahead)
);
router.post('/consulta-estoque/consultar', podeConsultaEstoque, async503(postConsultarEstoque));
router.get(
  '/consulta-estoque/detalhe/saldo',
  podeConsultaEstoque,
  async503(getSaldoDetalheConsultaEstoque)
);
router.get(
  '/consulta-estoque/detalhe/solicitacao',
  podeConsultaEstoque,
  async503(getScDetalheConsultaEstoque)
);
router.get(
  '/consulta-estoque/detalhe/cotacao',
  podeConsultaEstoque,
  async503(getCotacaoDetalheConsultaEstoque)
);
router.get(
  '/consulta-estoque/detalhe/pedido-compra',
  podeConsultaEstoque,
  async503(getPcDetalheConsultaEstoque)
);

router.get('/regras-data-entrega', podeVerRegrasEntrega, async503(getRegrasDataEntrega));
router.post(
  '/regras-data-entrega',
  validateCsrf,
  podeEditarRegrasEntrega,
  async503(postRegraDataEntregaVersao)
);

export default router;
