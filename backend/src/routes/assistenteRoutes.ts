import { Router } from 'express';
import {
  atualizarAlucinacao,
  criarConversa,
  excluirConversa,
  listarAlucinacoes,
  listarConversas,
  listarFeedbacksConversa,
  listarMensagens,
  perguntarAssistente,
  registrarFeedback,
  renomearConversa,
} from '../controllers/assistenteController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validateCsrf } from '../middleware/csrf.js';
import { PERMISSOES } from '../config/permissoes.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/alucinacoes',
  requirePermission(PERMISSOES.ASSISTENTE_ALUCINACOES_VER),
  listarAlucinacoes
);
router.patch(
  '/alucinacoes/:id',
  requirePermission(PERMISSOES.ASSISTENTE_ALUCINACOES_VER),
  validateCsrf,
  atualizarAlucinacao
);

router.use(requirePermission(PERMISSOES.ASSISTENTE_USAR));

router.get('/conversas', listarConversas);
router.post('/conversas', validateCsrf, criarConversa);
router.patch('/conversas/:id', validateCsrf, renomearConversa);
router.delete('/conversas/:id', validateCsrf, excluirConversa);
router.get('/conversas/:id/mensagens', listarMensagens);
router.get('/conversas/:id/feedbacks', listarFeedbacksConversa);
router.post('/perguntar', validateCsrf, perguntarAssistente);
router.post('/feedback', validateCsrf, registrarFeedback);

export default router;
