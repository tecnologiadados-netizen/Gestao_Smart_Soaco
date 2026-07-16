/**
 * Busca de clientes Nomus (pessoa + grupopessoa) para políticas comerciais «Outras».
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = 'sqlPoliticaComercialClientesNomus.sql';

function resolveSqlPath(file: string): string {
  const candidates = [
    join(__dirname, file),
    join(process.cwd(), 'src', 'data', file),
    join(process.cwd(), 'dist', 'data', file),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Arquivo ${file} não encontrado.`);
}

function getCell(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in row && row[name] !== undefined) return row[name];
    const target = name.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === target) return row[k];
    }
  }
  return undefined;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.toString('utf8').trim();
  return String(v).trim();
}

export type PoliticaComercialClienteNomus = {
  id: number;
  nome: string;
  idGrupoPessoa: number | null;
  grupo: string;
};

export async function buscarClientesPoliticaComercialNomus(
  q: string,
  limit = 50
): Promise<{ clientes: PoliticaComercialClienteNomus[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) {
    return { clientes: [], erro: 'NOMUS_DB_URL não configurado ou pool indisponível.' };
  }

  const termo = q.trim().slice(0, 120);
  const lim = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);

  let sql: string;
  try {
    sql = readFileSync(resolveSqlPath(SQL_FILE), 'utf-8').trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { clientes: [], erro: msg };
  }

  try {
    const [r] = await pool.query(sql, [termo, termo, termo, termo, lim]);
    const rows = (Array.isArray(r) ? r : []) as Record<string, unknown>[];
    const clientes: PoliticaComercialClienteNomus[] = rows.map((row) => {
      const idGrupoRaw = getCell(row, 'idGrupoPessoa');
      const idGrupo = idGrupoRaw == null || idGrupoRaw === '' ? null : Math.trunc(num(idGrupoRaw)) || null;
      return {
        id: Math.trunc(num(getCell(row, 'id'))) || 0,
        nome: str(getCell(row, 'nome')),
        idGrupoPessoa: idGrupo && idGrupo > 0 ? idGrupo : null,
        grupo: str(getCell(row, 'grupo')),
      };
    }).filter((c) => c.id > 0);
    return { clientes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { clientes: [], erro: msg };
  }
}
