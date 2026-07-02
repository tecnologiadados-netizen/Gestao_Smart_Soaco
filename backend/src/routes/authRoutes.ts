import { Router, type Request, type Response, type NextFunction } from 'express';
import { login, logout, getCsrf } from '../controllers/authController.js';
import { csrfProtect } from '../middleware/csrf.js';

const router = Router();
router.use(csrfProtect);

// /auth/ping está registrado em app.ts antes do body parser

router.get('/csrf', getCsrf);
router.post('/login', (req: Request, res: Response, _next: NextFunction) => {
  login(req, res).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('[authRoutes] login catch:', msg);
    if (stack) console.error('[authRoutes] stack:', stack);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Erro ao processar login. Tente novamente.' });
    }
  });
});
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    logout(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[authRoutes] logout catch:', msg);
    if (!res.headersSent) res.status(503).json({ error: 'Erro ao sair.' });
  }
});

export default router;
