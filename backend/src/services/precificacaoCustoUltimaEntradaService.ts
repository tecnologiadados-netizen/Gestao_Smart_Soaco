/**
 * Custo unitário via BOM + última entrada (mesma regra da Precificação / Engenharia).
 * SQL espelhado de engenhariaController — não altera a tela de Engenharia.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Pool } from 'mysql2/promise';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sqlBom: string | null = null;
let sqlValor: string | null = null;

function resolveSql(name: string): string {
  const candidates = [
    join(__dirname, '..', 'data', 'sql', name),
    join(process.cwd(), 'src', 'data', 'sql', name),
    join(process.cwd(), 'dist', 'data', 'sql', name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`SQL ${name} não encontrado.`);
}

function loadSqlBom(): string {
  if (!sqlBom) sqlBom = readFileSync(resolveSql('precificacaoListaMateriais.sql'), 'utf8');
  return sqlBom;
}

function loadSqlValor(): string {
  if (!sqlValor) sqlValor = readFileSync(resolveSql('precificacaoValorUnitario.sql'), 'utf8');
  return sqlValor;
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v: unknown): number {
  const n = toNum(v);
  return n ?? 0;
}

async function buscarValoresUnitarios(
  pool: Pool,
  idsComponentes: number[]
): Promise<Map<number, number>> {
  const mapa = new Map<number, number>();
  const uniq = [...new Set(idsComponentes.filter((id) => id > 0))];
  if (uniq.length === 0) return mapa;

  const chunkSize = 400;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const inList = chunk.join(',');
    const sql = loadSqlValor().replace(/__IN_IDS__/g, inList);
    const [rows] = await pool.query(sql);
    for (const r of (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]) {
      const id = toNum(r.idProduto ?? r.idproduto);
      const vu = toNum(r.valorUnitario ?? r.valorunitario);
      if (id == null || vu == null) continue;
      if (!mapa.has(id)) mapa.set(id, vu);
    }
  }
  return mapa;
}

export type CustoBomUltimaEntrada = {
  idProduto: number;
  /** Custo unitário do PA (soma componentes × qtd × última entrada). */
  custoUnitario: number | null;
  semCusto: boolean;
  qtdeComponentes: number;
  qtdeComponentesSemCusto: number;
};

/**
 * Calcula custo unitário BOM + última entrada para uma lista de produtos acabados.
 * Agrega consultas de valor unitário (evita N+1).
 */
export async function obterCustosBomUltimaEntrada(
  idsProduto: number[]
): Promise<Map<number, CustoBomUltimaEntrada>> {
  const out = new Map<number, CustoBomUltimaEntrada>();
  const uniq = [...new Set(idsProduto.filter((id) => id > 0))];
  for (const id of uniq) {
    out.set(id, {
      idProduto: id,
      custoUnitario: null,
      semCusto: true,
      qtdeComponentes: 0,
      qtdeComponentesSemCusto: 0,
    });
  }
  if (uniq.length === 0) return out;
  if (!isNomusEnabled()) return out;
  const pool = getNomusPool();
  if (!pool) return out;

  const bomPorPai = new Map<number, Map<number, number>>();
  const todosComps = new Set<number>();

  for (const idPai of uniq) {
    try {
      const [rows] = await pool.query(loadSqlBom(), [idPai]);
      const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
      const agg = new Map<number, number>();
      for (const r of list) {
        const idComp = toNum(r.idcomponente ?? r.idComponente);
        const qtd = toFloat(r.qtd);
        if (idComp == null || qtd <= 0) continue;
        agg.set(idComp, (agg.get(idComp) ?? 0) + qtd);
        todosComps.add(idComp);
      }
      bomPorPai.set(idPai, agg);
    } catch (e) {
      console.error(
        '[precificacaoCustoUltimaEntrada] BOM produto',
        idPai,
        e instanceof Error ? e.message : e
      );
    }
  }

  const paisSemBom = uniq.filter((id) => {
    const agg = bomPorPai.get(id);
    return !agg || agg.size === 0;
  });
  for (const id of paisSemBom) todosComps.add(id);

  const valores = await buscarValoresUnitarios(pool, [...todosComps]);

  for (const idPai of uniq) {
    const agg = bomPorPai.get(idPai);
    if (!agg || agg.size === 0) {
      const vu = valores.get(idPai) ?? null;
      out.set(idPai, {
        idProduto: idPai,
        custoUnitario: vu,
        semCusto: vu == null,
        qtdeComponentes: 0,
        qtdeComponentesSemCusto: vu == null ? 1 : 0,
      });
      continue;
    }

    let total = 0;
    let sem = 0;
    for (const [idComp, qtd] of agg) {
      const vu = valores.get(idComp);
      if (vu == null) {
        sem += 1;
        continue;
      }
      total += qtd * vu;
    }
    const custo = sem > 0 || !(total > 0) ? null : Math.round(total * 100) / 100;
    out.set(idPai, {
      idProduto: idPai,
      custoUnitario: custo,
      semCusto: custo == null,
      qtdeComponentes: agg.size,
      qtdeComponentesSemCusto: sem,
    });
  }

  return out;
}
