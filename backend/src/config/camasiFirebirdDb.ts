/**
 * Conexão Firebird (Camasi / RICMAQ) — somente leitura para painel de produção.
 *
 * Variáveis:
 *   CAMASI_FDB_PATH=C:\bdcamasi\RICMAQ.FDB
 *   CAMASI_FDB_USER=SYSDBA
 *   CAMASI_FDB_PASSWORD=masterkey
 *   CAMASI_FDB_HOST=127.0.0.1
 *   CAMASI_FDB_PORT=3050
 */

import { attachAsync, type Options } from 'node-firebird';

function buildOptions(): Options {
  const database =
    process.env.CAMASI_FDB_PATH?.trim() || 'C:\\bdcamasi\\RICMAQ.FDB';
  const host = process.env.CAMASI_FDB_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.CAMASI_FDB_PORT ?? 3050);
  const user = process.env.CAMASI_FDB_USER?.trim() || 'SYSDBA';
  const password = process.env.CAMASI_FDB_PASSWORD ?? 'masterkey';

  return {
    host,
    port: Number.isFinite(port) ? port : 3050,
    database,
    user,
    password,
    lowercase_keys: true,
    encoding: 'UTF8',
  };
}

export function isCamasiEnabled(): boolean {
  return process.env.CAMASI_FDB_DISABLED !== 'true';
}

export function getCamasiDatabasePath(): string {
  return buildOptions().database ?? 'C:\\bdcamasi\\RICMAQ.FDB';
}

/** Executa SELECT (ou qualquer SQL de leitura) e devolve as linhas. */
export async function queryCamasi<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!isCamasiEnabled()) {
    throw new Error('Conexão Camasi desabilitada (CAMASI_FDB_DISABLED=true).');
  }
  const db = await attachAsync(buildOptions());
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
    return { ok: true, mensagem: 'Conexão Firebird OK.' };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    return { ok: false, mensagem };
  }
}
