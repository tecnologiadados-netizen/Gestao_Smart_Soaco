/**
 * Conexão MySQL somente leitura com o Nomus (weberp_soaco).
 * Nenhuma alteração é feita no banco Nomus; apenas SELECT.
 * Usa parsing explícito da URL para tratar senha com # e @ corretamente.
 */

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let resettingPool: Promise<void> | null = null;

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
      // Nomus (legado) usa utf8mb4_general_ci; MySQL 8 defaulta literais em 0900_ai_ci.
      charset: 'utf8mb4_general_ci',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 45_000,
      // Evita ECONNRESET em conexões idle do pool (MySQL wait_timeout).
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      idleTimeout: 60_000,
      maxIdle: 5,
    };
  } catch {
    return {
      uri: url,
      charset: 'utf8mb4_general_ci',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 45_000,
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

/** Encerra o pool atual para forçar novas conexões após ETIMEDOUT / connection lost. */
export async function resetNomusPool(): Promise<void> {
  if (resettingPool) {
    await resettingPool;
    return;
  }
  const old = pool;
  pool = null;
  if (!old) return;
  resettingPool = (async () => {
    try {
      await old.end();
    } catch {
      /* pool já fechado / conexões mortas */
    }
  })();
  try {
    await resettingPool;
  } finally {
    resettingPool = null;
  }
}

export function isNomusEnabled(): boolean {
  return !!process.env.NOMUS_DB_URL?.trim();
}

function nomusErrCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : '';
}

function nomusErrMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

/** Pool mysql2 encerrado / fatal — precisa recriar, senão as outras queries da DFC caem em 503. */
export function isNomusPoolDeadError(err: unknown): boolean {
  const code = nomusErrCode(err);
  const msg = nomusErrMsg(err);
  return (
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    /Pool is closed|enqueue after fatal|PROTOCOL_ENQUEUE_AFTER_FATAL/i.test(msg)
  );
}

/** Erros de conexão transitórios do MySQL (vale retry 1–2x). */
export function isNomusTransientConnectionError(err: unknown): boolean {
  const code = nomusErrCode(err);
  const msg = nomusErrMsg(err);
  if (isNomusPoolDeadError(err)) return true;
  return (
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    /ECONNRESET|PROTOCOL_CONNECTION_LOST|EPIPE|ETIMEDOUT|Connection lost/i.test(msg)
  );
}

/** Executa query Nomus com retry curto. Só recria o pool se ele estiver morto (não em timeout). */
export async function nomusQueryWithRetry<T = unknown>(
  _initialPool: mysql.Pool,
  sql: string,
  params?: unknown[],
  tentativas = 2
): Promise<[T, mysql.FieldPacket[]]> {
  let lastErr: unknown;
  for (let i = 0; i < tentativas; i++) {
    const activePool = getNomusPool();
    if (!activePool) throw lastErr ?? new Error('NOMUS_DB_URL não configurado');
    try {
      return (await activePool.query(sql, params)) as [T, mysql.FieldPacket[]];
    } catch (err) {
      lastErr = err;
      if (!isNomusTransientConnectionError(err) || i === tentativas - 1) throw err;
      if (isNomusPoolDeadError(err)) {
        await resetNomusPool();
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}
