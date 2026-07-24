/**
 * Conexão MySQL somente leitura com o Nomus (weberp_soaco).
 * Nenhuma alteração é feita no banco Nomus; apenas SELECT.
 * Usa parsing explícito da URL para tratar senha com # e @ corretamente.
 */

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function parseNomusUrl(url: string): mysql.PoolOptions {
  try {
    const u = new URL(url);
    const port = u.port ? Number(u.port) : 3306;
    const database = (u.pathname || '/').replace(/^\//, '') || 'weberp_soaco';
    return {
      host: u.hostname,
      port: Number.isNaN(port) ? 3306 : port,
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 15000,
      // Evita ECONNRESET em conexões idle do pool (MySQL wait_timeout).
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      idleTimeout: 60_000,
      maxIdle: 5,
    };
  } catch {
    return {
      uri: url,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
    };
  }
}

export function getNomusPool(): mysql.Pool | null {
  const url = process.env.NOMUS_DB_URL;
  if (!url || url.trim() === '') return null;
  if (!pool) {
    const opts = parseNomusUrl(url.trim());
    pool = mysql.createPool(opts);
  }
  return pool;
}

export function isNomusEnabled(): boolean {
  return !!process.env.NOMUS_DB_URL?.trim();
}

/** Erros de conexão transitórios do MySQL (vale retry 1–2x). */
export function isNomusTransientConnectionError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    /ECONNRESET|PROTOCOL_CONNECTION_LOST|EPIPE|ETIMEDOUT|Connection lost/i.test(msg)
  );
}

/** Executa query Nomus com retry curto em ECONNRESET / connection lost. */
export async function nomusQueryWithRetry<T = unknown>(
  pool: mysql.Pool,
  sql: string,
  params?: unknown[],
  tentativas = 3
): Promise<[T, mysql.FieldPacket[]]> {
  let lastErr: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return (await pool.query(sql, params)) as [T, mysql.FieldPacket[]];
    } catch (err) {
      lastErr = err;
      if (!isNomusTransientConnectionError(err) || i === tentativas - 1) throw err;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw lastErr;
}
