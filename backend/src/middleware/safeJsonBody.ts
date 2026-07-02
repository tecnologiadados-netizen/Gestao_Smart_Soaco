import type { Request, Response, NextFunction } from 'express';

/**
 * Body parser JSON que não lança: em erro de parsing ou body vazio, define req.body = {}.
 * Evita 500 quando o proxy ou cliente envia body inválido (express.json() lançava).
 */
export function safeJsonBody(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  const done = () => {
    try {
      const raw = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
      if (!raw || raw.trim() === '') {
        req.body = {};
      } else {
        try {
          req.body = JSON.parse(raw) as Record<string, unknown>;
        } catch (e) {
          console.error('[safeJsonBody] JSON inválido:', (e as Error)?.message);
          req.body = {};
        }
      }
    } catch (e) {
      console.error('[safeJsonBody] Erro:', (e as Error)?.message);
      req.body = {};
    }
    next();
  };

  if (req.readableEnded) {
    done();
    return;
  }
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', done);
  req.on('error', (err) => {
    console.error('[safeJsonBody] Erro stream:', err?.message ?? err);
    req.body = {};
    next();
  });
}
