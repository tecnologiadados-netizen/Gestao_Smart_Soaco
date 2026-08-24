import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateCsrf } from '../middleware/csrf.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSOES } from '../config/permissoes.js';
import {
  getRecebimentoDigitacaoDocumento,
  getRecebimentoDigitacaoPendencias,
  getRecebimentoMesaConferentes,
  getRecebimentoMesaDocumentos,
  getRecebimentoMesaItens,
  postRecebimentoDigitacaoDevolver,
  postRecebimentoDigitacaoItem,
  postRecebimentoMesaDeliberar,
} from '../controllers/recebimentoController.js';

const router = Router();
router.use(requireAuth);

const verMesa = requirePermission(PERMISSOES.RECEBIMENTO_MESA, PERMISSOES.RECEBIMENTO_TOTAL);
const verConferente = requirePermission(PERMISSOES.RECEBIMENTO_CONFERENTE, PERMISSOES.RECEBIMENTO_TOTAL);

function async503(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      const cause = err instanceof Error ? err.message : String(err);
      console.error('[recebimentoRoutes]', cause, err instanceof Error ? err.stack : '');
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Serviço temporariamente indisponível. Tente novamente.',
          cause,
        });
      }
    });
  };
}

router.get('/mesa/documentos', verMesa, async503(getRecebimentoMesaDocumentos));
router.get('/mesa/documentos/:id/itens', verMesa, async503(getRecebimentoMesaItens));
router.get('/mesa/conferentes', verMesa, async503(getRecebimentoMesaConferentes));
router.post(
  '/mesa/documentos/:id/deliberar',
  validateCsrf,
  verMesa,
  async503(postRecebimentoMesaDeliberar)
);

router.get('/digitacao/pendencias', verConferente, async503(getRecebimentoDigitacaoPendencias));
router.get('/digitacao/documentos/:id', verConferente, async503(getRecebimentoDigitacaoDocumento));
router.post(
  '/digitacao/documentos/:id/itens',
  validateCsrf,
  verConferente,
  async503(postRecebimentoDigitacaoItem)
);
router.post(
  '/digitacao/documentos/:id/devolver',
  validateCsrf,
  verConferente,
  async503(postRecebimentoDigitacaoDevolver)
);

export default router;
