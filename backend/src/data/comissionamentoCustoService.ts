/**
 * Custo unitário de produtos para Análise de Comissionamento.
 * Reutiliza o motor CPV DRE Só Aço (BOM + custo médio mensal), SEM Markup/MKP.
 *
 * Otimização:
 * - BOM em cache em memória (TTL)
 * - Custo médio mensal carregado 1× por faixa de datas
 * - Custo unitário memoizado por (idProduto, YYYY-MM)
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOM_TTL_MS = 30 * 60 * 1000;
const LOOKBACK_MESES = 18;

type BomComp = { idComp: number; qtd: number };
type CustoPonto = { ym: string; custo: number; t: number };

let bomCache: { at: number; byPai: Map<number, BomComp[]> } | null = null;
let sqlBom: string | null = null;
let sqlCusto: string | null = null;

function resolveSql(name: string): string {
  const candidates = [
    join(__dirname, 'sql', name),
    join(process.cwd(), 'src', 'data', 'sql', name),
    join(process.cwd(), 'dist', 'data', 'sql', name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`SQL ${name} não encontrado.`);
}

function loadSqlBom(): string {
  if (!sqlBom) sqlBom = readFileSync(resolveSql('comissionamentoBom.sql'), 'utf8');
  return sqlBom;
}

function loadSqlCusto(): string {
  if (!sqlCusto) sqlCusto = readFileSync(resolveSql('comissionamentoCustoMedio.sql'), 'utf8');
  return sqlCusto;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymToT(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + m;
}

function shiftYmMonths(ymd: string, deltaMonths: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converte periodo do Nomus (Date mysql2, ISO ou YYYY-MM-DD) para YYYY-MM. */
export function periodoToYm(periodo: unknown): string {
  if (periodo instanceof Date && !Number.isNaN(periodo.getTime())) {
    return `${periodo.getFullYear()}-${String(periodo.getMonth() + 1).padStart(2, '0')}`;
  }
  const raw = String(periodo ?? '').trim();
  const iso = /^(\d{4}-\d{2})/.exec(raw);
  if (iso) return iso[1]!;
  return '';
}

async function carregarBom(): Promise<Map<number, BomComp[]>> {
  const now = Date.now();
  if (bomCache && now - bomCache.at < BOM_TTL_MS) return bomCache.byPai;
  if (!isNomusEnabled()) return new Map();
  const pool = getNomusPool();
  if (!pool) return new Map();

  const [rows] = await pool.query(loadSqlBom());
  const byPai = new Map<number, BomComp[]>();
  for (const r of (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]) {
    const idPai = Math.trunc(toNum(r.idProdutoPai ?? r.idprodutopai));
    const idComp = Math.trunc(toNum(r.idComponente ?? r.idcomponente));
    const qtd = toNum(r.qtdTotal ?? r.qtdtotal);
    if (!idPai || !idComp || qtd <= 0) continue;
    const list = byPai.get(idPai) ?? [];
    list.push({ idComp, qtd });
    byPai.set(idPai, list);
  }
  bomCache = { at: now, byPai };
  return byPai;
}

async function carregarCustosMedios(
  dataIni: string,
  dataFim: string,
  idProdutos?: number[]
): Promise<Map<number, CustoPonto[]>> {
  if (!isNomusEnabled()) return new Map();
  const pool = getNomusPool();
  if (!pool) return new Map();

  const dataMin = shiftYmMonths(dataIni, -LOOKBACK_MESES);
  const ids = [...new Set((idProdutos ?? []).filter((n) => n > 0))];
  const idFilter =
    ids.length > 0 && ids.length <= 2500 ? `AND e.idProduto IN (${ids.join(',')})` : '';
  const sql = loadSqlCusto()
    .replace(/\{\{DATA_ENTRADA_MIN\}\}/g, dataMin)
    .replace(/\{\{DATA_ENTRADA_MAX\}\}/g, dataFim)
    .replace(/\{\{ID_PRODUTO_FILTER\}\}/g, idFilter);

  const [rows] = await pool.query(sql);
  const map = new Map<number, CustoPonto[]>();
  for (const r of (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]) {
    const id = Math.trunc(toNum(r.idProduto ?? r.idproduto));
    const ym = periodoToYm(r.periodo);
    const custo = toNum(r.custoMedioMensal ?? r.customediomensal);
    if (!id || !ym || custo <= 0) continue;
    const list = map.get(id) ?? [];
    list.push({ ym, custo, t: ymToT(ym) });
    map.set(id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.t - b.t);
  }
  return map;
}

/** Mesmo critério do DRE: prioriza período <= alvo, senão o mais próximo. */
function nearestCusto(series: CustoPonto[] | undefined, ym: string): number | null {
  if (!series?.length) return null;
  const t = ymToT(ym);
  let best: CustoPonto | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const p of series) {
    const before = p.t <= t ? 0 : 1;
    const dist = Math.abs(p.t - t);
    const score = before * 1_000_000 + dist;
    if (score < bestScore || (score === bestScore && best && p.t > best.t)) {
      bestScore = score;
      best = p;
    }
  }
  return best?.custo ?? null;
}

function custoUnitarioProduto(
  idProduto: number,
  ym: string,
  bom: Map<number, BomComp[]>,
  custos: Map<number, CustoPonto[]>,
  memo: Map<string, number | null>
): number | null {
  const key = `${idProduto}|${ym}`;
  if (memo.has(key)) return memo.get(key)!;

  const comps = bom.get(idProduto);
  let unit: number | null = null;

  if (comps && comps.length > 0) {
    let sum = 0;
    let ok = true;
    for (const c of comps) {
      const u = nearestCusto(custos.get(c.idComp), ym);
      if (u == null) {
        ok = false;
        break;
      }
      sum += u * c.qtd;
    }
    unit = ok && sum > 0 ? sum : null;
  }

  if (unit == null) {
    unit = nearestCusto(custos.get(idProduto), ym);
  }

  memo.set(key, unit);
  return unit;
}

export type LinhaComCusto = {
  idProduto: number;
  mes: string;
  qtde: number;
  valorVendido: number;
  custoUnitario?: number | null;
  custoTotal?: number | null;
  margem?: number | null;
  margemPct?: number | null;
};

/**
 * Enriquece linhas in-place com custo/margem (sem MKP).
 * Carrega BOM (cache) + custos médios. Falha de custo não derruba a análise de vendas.
 */
export async function enriquecerLinhasComCusto<T extends LinhaComCusto>(
  rows: T[],
  dataIni: string,
  dataFim: string
): Promise<T[]> {
  if (!rows.length) return rows;
  if (!isNomusEnabled()) return rows;

  const ids = new Set<number>();
  for (const r of rows) {
    if (r.idProduto > 0) ids.add(r.idProduto);
  }
  if (ids.size === 0) return rows;

  try {
    const bom = await carregarBom();
    const needed = new Set(ids);
    for (const id of ids) {
      for (const c of bom.get(id) ?? []) needed.add(c.idComp);
    }

    const custos = await carregarCustosMedios(dataIni, dataFim, [...needed]);
    const memo = new Map<string, number | null>();

    for (const r of rows) {
      if (!r.idProduto || !r.mes) {
        r.custoUnitario = null;
        r.custoTotal = null;
        r.margem = null;
        r.margemPct = null;
        continue;
      }
      const unit = custoUnitarioProduto(r.idProduto, r.mes, bom, custos, memo);
      if (unit == null || unit <= 0) {
        r.custoUnitario = null;
        r.custoTotal = null;
        r.margem = null;
        r.margemPct = null;
        continue;
      }
      const custoTotal = Math.round(unit * r.qtde * 100) / 100;
      const margem = Math.round((r.valorVendido - custoTotal) * 100) / 100;
      r.custoUnitario = Math.round(unit * 10000) / 10000;
      r.custoTotal = custoTotal;
      r.margem = margem;
      r.margemPct =
        r.valorVendido > 0 ? Math.round((margem / r.valorVendido) * 1000) / 10 : null;
    }
  } catch (err) {
    console.error('enriquecerLinhasComCusto', err);
    for (const r of rows) {
      r.custoUnitario = null;
      r.custoTotal = null;
      r.margem = null;
      r.margemPct = null;
    }
  }
  return rows;
}
