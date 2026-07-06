import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PERMISSOES } from '../config/permissoes.js';
import type { JwtPayload } from './auth.js';
import { getPermissoesUsuario } from './requirePermission.js';

const JWT_SECRET = process.env.JWT_SECRET || 'troque-isto';

/**
 * Protege o módulo SGQ (HTML/Next.js) com o mesmo login e permissão qualidade.ver.
 */
export async function sgqAccessGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const url = req.originalUrl ?? req.url;
  if (!url.startsWith('/qualidade/sgq')) {
    next();
    return;
  }

  const pathOnly = url.split('?')[0];
  const isNextAsset =
    pathOnly.includes('/_next') ||
    pathOnly.includes('/favicon') ||
    /\.(js|css|woff2?|ico|png|svg|webp)$/i.test(pathOnly);

  const isEmbed = url.includes('embed=1');

  // URL antiga ou acesso direto: abre dentro do Gestão Smart, não como app separado
  if (!isEmbed && !isNextAsset) {
    const rest = pathOnly.replace(/^\/qualidade\/sgq\/?/, '') || 'documentos';
    res.redirect(302, `/qualidade/${rest}`);
    return;
  }

  const token =
    req.cookies?.token ??
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    if (isEmbed) {
      res
        .status(401)
        .type('text/html; charset=utf-8')
        .send(
          '<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;padding:1.5rem;color:#475569">' +
            '<p>Sessão expirada. Feche esta aba e faça login novamente no Gestão Smart.</p></body></html>'
        );
      return;
    }
    res.redirect(302, '/');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const perms = await getPermissoesUsuario(decoded.login);
    if (!perms.includes(PERMISSOES.QUALIDADE_VER)) {
      res.redirect(302, '/sem-acesso');
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.redirect(302, '/');
  }
}
