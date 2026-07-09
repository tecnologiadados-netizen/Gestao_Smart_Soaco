import http from 'node:http';
import type { Request, Response, NextFunction } from 'express';

const DEFAULT_SGQ_PORT = 3001;

function sgqPort(): number {
  const raw = process.env.SGQ_PORT?.trim() || String(DEFAULT_SGQ_PORT);
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_SGQ_PORT;
}

/**
 * Encaminha /qualidade/sgq/* para o servidor Next.js do módulo SGQ.
 */
export function sgqAppProxy(req: Request, res: Response, next: NextFunction): void {
  const url = req.originalUrl ?? req.url;
  if (!url.startsWith('/qualidade/sgq')) {
    next();
    return;
  }

  const port = sgqPort();
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${port}`,
      },
    },
    (proxyRes) => {
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[sgq-proxy]', err.message);
    if (!res.headersSent) {
      res
        .status(503)
        .type('text/plain; charset=utf-8')
        .send('Módulo Qualidade (SGQ) indisponível. Verifique se o serviço SGQ está em execução.');
    }
  });

  req.pipe(proxyReq);
}
