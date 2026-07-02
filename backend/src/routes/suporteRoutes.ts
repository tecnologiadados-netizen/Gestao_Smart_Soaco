import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createSupportTicket,
  createSupportTicketMessage,
  getSupportNotificationsUnreadCount,
  getSupportTicketById,
  listSupportCatalog,
  listSupportModulosArea,
  listSupportTickets,
  replaceSupportCatalog,
  setSupportTicketRead,
  updateSupportTicketStatus,
  updateSupportTicketPrioridade,
} from '../controllers/suporteController.js';

const router = Router();
router.use(requireAuth);

router.get('/catalog', listSupportCatalog);
router.get('/modulos-area', listSupportModulosArea);
router.put('/catalog', replaceSupportCatalog);
router.get('/notifications/unread-count', getSupportNotificationsUnreadCount);
router.get('/tickets', listSupportTickets);
router.post('/tickets', createSupportTicket);
router.get('/tickets/:id', getSupportTicketById);
router.post('/tickets/:id/messages', createSupportTicketMessage);
router.patch('/tickets/:id/status', updateSupportTicketStatus);
router.patch('/tickets/:id/prioridade', updateSupportTicketPrioridade);
router.put('/tickets/:id/read', setSupportTicketRead);

export default router;
