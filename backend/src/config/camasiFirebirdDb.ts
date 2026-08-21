/**
 * Conexão Firebird (Camasi / RICMAQ) — somente leitura para painel de produção.
 *
 * Variáveis:
 *   CAMASI_FDB_PATH=C:\bdcamasi\RICMAQ.FDB
 *   CAMASI_FDB_USER=SYSDBA
 *   CAMASI_FDB_PASSWORD=masterkey
 *   CAMASI_FDB_HOST=127.0.0.1
 *     (vários hosts separados por vírgula: tenta na ordem, com timeout)
 *   CAMASI_FDB_PORT=3050
 *   CAMASI_FDB_CONNECT_TIMEOUT_MS=4000
 */

import { attachAsync, type Database, type Options } from 'node-firebird';

const ATTACH_TIMEOUT_MS = Number(process.env.CAMASI_FDB_CONNECT_TIMEOUT_MS ?? 4000);

let lastGoodHost: string | null = null;

function databasePath(): string {
  return process.env.CAMASI_FDB_PATH?.trim() || 'C:\\bdcamasi\\RICMAQ.FDB';
}

function portNum(): number {
  const port = Number(process.env.CAMASI_FDB_PORT ?? 3050);
  return Number.isFinite(port) ? port : 3050;
}

export function camasiHostCandidates(): string[] {
  const raw = process.env.CAMASI_FDB_HOST?.trim() || '127.0.0.1';
  const listed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const h of [lastGoodHost, ...listed]) {
    if (h && !out.includes(h)) out.push(h);
  }
  return out.length ? out : ['127.0.0.1'];
}

function optionsFor(host: string): Options {
  return {
    host,
    port: portNum(),
    database: databasePath(),
    user: process.env.CAMASI_FDB_USER?.trim() || 'SYSDBA',
    password: process.env.CAMASI_FDB_PASSWORD ?? 'masterkey',
    lowercase_keys: true,
    encoding: 'UTF8',
  };
}

function buildOptions(): Options {
  return optionsFor(camasiHostCandidates()[0] ?? '127.0.0.1');
}

export function isCamasiEnabled(): boolean {
  return process.env.CAMASI_FDB_DISABLED !== 'true';
}

export function getCamasiDatabasePath(): string {
  return databasePath();
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function attachHost(host: string): Promise<Database> {
  const opts = optionsFor(host);
  const timeoutMs = Number.isFinite(ATTACH_TIMEOUT_MS) && ATTACH_TIMEOUT_MS > 0 ? ATTACH_TIMEOUT_MS : 4000;
  let late: Database | null = null;
  try {
    return await Promise.race([
      attachAsync(opts).then((db) => {
        late = db;
        return db;
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`timeout após ${timeoutMs}ms em ${host}:${opts.port}`));
        }, timeoutMs);
      }),
    ]);
  } catch (e) {
    if (late) {
      try {
        await late.detachAsync();
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
}

async function attachCamasi(): Promise<Database> {
  const hosts = camasiHostCandidates();
  const erros: string[] = [];
  for (const host of hosts) {
    try {
      const db = await attachHost(host);
      lastGoodHost = host;
      return db;
    } catch (err) {
      erros.push(`${host}:${portNum()} → ${errMsg(err)}`);
    }
  }
  throw new Error(erros.join(' | '));
}

/** Executa SELECT (ou qualquer SQL de leitura) e devolve as linhas. */
export async function queryCamasi<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!isCamasiEnabled()) {
    throw new Error('Conexão Camasi desabilitada (CAMASI_FDB_DISABLED=true).');
  }
  const db = await attachCamasi();
  try {
    const rows = await db.queryAsync(sql, params);
    return (rows ?? []) as T[];
  } finally {
    await db.detachAsync();
  }
}

/** Testa conexão com um SELECT mínimo. */
export async function testCamasiConnection(): Promise<{ ok: boolean; mensagem: string }> {
  if (!isCamasiEnabled()) {
    return { ok: false, mensagem: 'Conexão Camasi desabilitada (CAMASI_FDB_DISABLED=true).' };
  }
  try {
    await queryCamasi('SELECT 1 AS OK FROM RDB$DATABASE');
    const host = lastGoodHost ?? camasiHostCandidates()[0];
    return { ok: true, mensagem: `Conexão Firebird OK (${host}).` };
  } catch (err) {
    return { ok: false, mensagem: errMsg(err) };
  }
}

export { buildOptions };
