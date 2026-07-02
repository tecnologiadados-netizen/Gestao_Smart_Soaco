/**
 * Conexão SQL Server (Shop9 / S9_Real) — somente leitura para DFC.
 */

import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function buildConfig(): sql.config {
  const host = process.env.SHOP9_DB_HOST?.trim() || '';
  const port = Number(process.env.SHOP9_DB_PORT ?? 1433);
  const database = process.env.SHOP9_DB_NAME?.trim() || 'S9_Real';
  const user = process.env.SHOP9_DB_USER?.trim() || '';
  const password = process.env.SHOP9_DB_PASSWORD ?? '';

  return {
    server: host,
    port: Number.isFinite(port) ? port : 1433,
    database,
    user,
    password,
    options: {
      encrypt: process.env.SHOP9_DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.SHOP9_DB_TRUST_CERT !== 'false',
    },
    pool: { max: 8, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 20_000,
    requestTimeout: 120_000,
  };
}

export function isShop9Enabled(): boolean {
  return !!(
    process.env.SHOP9_DB_HOST?.trim() &&
    process.env.SHOP9_DB_USER?.trim() &&
    process.env.SHOP9_DB_PASSWORD != null
  );
}

export async function getShop9Pool(): Promise<sql.ConnectionPool | null> {
  if (!isShop9Enabled()) return null;
  if (pool?.connected) return pool;
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    const cfg = buildConfig();
    const p = new sql.ConnectionPool(cfg);
    await p.connect();
    pool = p;
    return p;
  })();

  try {
    return await poolPromise;
  } catch (err) {
    poolPromise = null;
    pool = null;
    throw err;
  }
}
