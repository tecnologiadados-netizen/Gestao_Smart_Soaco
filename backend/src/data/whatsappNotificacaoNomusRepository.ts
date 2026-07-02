/**
 * Execução segura de SQL Nomus (somente SELECT) para mensagens SMS/WhatsApp.
 */

import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const MAX_ROWS = 100;
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE|CALL)\b/i;

export function validarSqlNomus(sql: string): string | null {
  const trimmed = sql.trim();
  if (!trimmed) return 'SQL vazio.';
  if (!/^SELECT\b/is.test(trimmed)) return 'Somente consultas SELECT são permitidas.';
  if (trimmed.includes(';')) return 'Não use ponto e vírgula no SQL.';
  if (/--|\/\*/.test(trimmed)) return 'Comentários SQL não são permitidos.';
  if (FORBIDDEN.test(trimmed)) return 'SQL contém comando não permitido.';
  return null;
}

function ensureLimit(sql: string): string {
  if (/\bLIMIT\s+\d+/i.test(sql)) return sql;
  return `${sql.replace(/\s+$/, '')} LIMIT ${MAX_ROWS}`;
}

export async function executarSqlSeguro(sql: string): Promise<Record<string, unknown>[]> {
  if (!isNomusEnabled()) throw new Error('Nomus não configurado (NOMUS_DB_URL).');
  const err = validarSqlNomus(sql);
  if (err) throw new Error(err);

  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const sqlFinal = ensureLimit(sql.trim());
  const [rows] = (await pool.query(sqlFinal)) as [Record<string, unknown>[], unknown];
  return Array.isArray(rows) ? rows : [];
}
