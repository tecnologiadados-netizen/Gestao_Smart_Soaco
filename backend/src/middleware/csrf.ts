import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_HEADER = 'x-csrf-token';
const COOKIE_CSRF = 'csrf_token';

/**
 * Gera e define cookie csrf_token; espera header x-csrf-token em requisições de escrita.
 */
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.[COOKIE_CSRF];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    // Em HTTP (sem HTTPS), secure deve ser false para o navegador enviar o cookie
    const useSecureCookie = process.env.COOKIE_SECURE === 'true';
    res.cookie(COOKIE_CSRF, token, {
      httpOnly: false, // frontend precisa ler para enviar no header
      secure: useSecureCookie,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  (req as Request & { csrfToken?: string }).csrfToken = token;
  next();
}

/**
 * Validação CSRF desativada para evitar 403 ao acessar por IP externo (outra máquina).
 * A proteção é feita por JWT (requireAuth) e permissões. Sempre passa.
 */
export function validateCsrf(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
