import type { Pool } from 'mysql2/promise';
import { nomusQueryWithRetry } from '../config/nomusDb.js';
import {
  METODO_RESSUPRIMENTO_VAZIO,
  rotuloMetodoRessuprimento,
} from '../utils/metodoRessuprimentoProduto.js';

const CHUNK = 150;

function normCod(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normCodKey(s: string): string {
  return normCod(s).toUpperCase();
}

export async function obterMetodosRessuprimentoPorCodigos(
  pool: Pool,
  codigosRaw: string[]
): Promise<{ porCodigo: Record<string, string> }> {
  const uniq = [...new Set(codigosRaw.map(normCod).filter(Boolean))];
  const porCodigo: Record<string, string> = {};
  if (uniq.length === 0) return { porCodigo };

  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `
      SELECT nome, padraoSuprimento
      FROM produto
      WHERE nome COLLATE utf8mb4_general_ci IN (${placeholders})
        AND ativo = 1
    `;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const nome = normCod(String(r.nome ?? ''));
      if (!nome) continue;
      const key = normCodKey(nome);
      if (porCodigo[key]) continue;
      const rotulo = rotuloMetodoRessuprimento(r.padraoSuprimento);
      if (rotulo) porCodigo[key] = rotulo;
    }
  }
  return { porCodigo };
}

/** IDs cujo método de ressuprimento está no filtro. Sem filtro, devolve todos. */
export async function filtrarIdsPorMetodoRessuprimento(
  pool: Pool,
  ids: number[],
  metodos: string[]
): Promise<Set<number>> {
  const porId = await obterMetodosRessuprimentoPorIds(pool, ids);
  if (metodos.length === 0) return new Set(porId.keys());
  const metodoSet = new Set(metodos);
  return new Set([...porId].filter(([, metodo]) => metodoSet.has(metodo)).map(([id]) => id));
}

/** Método atual da aba Geral do produto, indexado pelo ID Nomus. */
export async function obterMetodosRessuprimentoPorIds(
  pool: Pool,
  ids: number[]
): Promise<Map<number, string>> {
  const uniq = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const out = new Map<number, string>();
  if (uniq.length === 0) return out;
  const visto = new Set<number>();
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const sql = `SELECT id, padraoSuprimento FROM produto WHERE id IN (${placeholders})`;
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, chunk);
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      visto.add(id);
      const rotulo = rotuloMetodoRessuprimento(r.padraoSuprimento) || METODO_RESSUPRIMENTO_VAZIO;
      out.set(id, rotulo);
    }
  }
  for (const id of uniq) {
    if (!visto.has(id)) out.set(id, METODO_RESSUPRIMENTO_VAZIO);
  }
  return out;
}
