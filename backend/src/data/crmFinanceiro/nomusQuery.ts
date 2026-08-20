import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../../config/nomusDb.js';

type QueryParam = string | number | boolean | null;

export async function nomusQuery<T>(
  sql: string,
  params: QueryParam[] = [],
): Promise<T[]> {
  if (!isNomusEnabled()) {
    throw new Error('Nomus não configurado (NOMUS_DB_URL).');
  }
  const pool = getNomusPool();
  if (!pool) {
    throw new Error('Pool Nomus indisponível.');
  }
  const [rows] = await nomusQueryWithRetry<T[]>(pool, sql, params);
  return rows;
}
