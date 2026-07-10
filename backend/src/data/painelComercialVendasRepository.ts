/**
 * Painel Comercial (Vendas) — leitura Nomus (MySQL) e agregações em memória.
 * Escopo: Só Aço (idEmpresa = 1).
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = 'sqlPainelComercialVendasNomus.sql';

function resolveSqlPath(fileName: string): string {
  const candidates = [join(__dirname, fileName), join(process.cwd(), 'src', 'data', fileName), join(process.cwd(), 'dist', 'data', fileName)];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Arquivo ${fileName} não encontrado.`);
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function clampYmd(s: string): string | null {
  const v = String(s ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function pctChange(atual: number, base: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(base)) return null;
  if (base === 0) return atual === 0 ? 0 : null;
  return Math.round(((atual - base) / base) * 1000) / 10;
}

function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';

export interface FiltrosPainelComercialVendas {
  dataIni: string;
  dataFim: string;
  comparacaoBase?: ComparacaoBase;
  grupoProduto?: string;
  subgrupo1?: string;
  subgrupo2?: string;
  vendedor?: string;
  regiao?: string;
  uf?: string;
  municipio?: string;
  cliente?: string;
  produto?: string;
  pd?: string;
}

export interface VendaPainelRow {
  pdId: number;
  pdCodigo: string;
  dataEmissao: string; // YYYY-MM-DD
  mes: string; // YYYY-MM
  cliente: string;
  vendedor: string;
  uf: string;
  municipio: string;
  regiao: string;
  codigoProduto: string;
  descricaoProduto: string;
  grupoProduto: string;
  subgrupo1: string;
  subgrupo2: string;
  qtdeVendida: number;
  valorVendido: number;
}

export type DrillDim = 'mes' | 'grupo' | 'subgrupo1' | 'subgrupo2' | 'vendedor' | 'regiao' | 'uf' | 'municipio' | 'produto' | 'cliente';

export interface DrillContexto {
  dim: DrillDim;
  /** Filtros adicionais do clique (ex.: mes='2026-06', grupoProduto='X'). */
  where?: Partial<Pick<
    VendaPainelRow,
    | 'mes'
    | 'grupoProduto'
    | 'subgrupo1'
    | 'subgrupo2'
    | 'vendedor'
    | 'regiao'
    | 'uf'
    | 'municipio'
    | 'codigoProduto'
    | 'cliente'
    | 'pdCodigo'
  >>;
}

export interface PainelComercialVendasKpis {
  valor: number;
  valorBase: number;
  valorVarPct: number | null;
  qtde: number;
  qtdeBase: number;
  qtdeVarPct: number | null;
  ticketMedio: number;
  ticketMedioBase: number;
  ticketMedioVarPct: number | null;
  pedidos: number;
  pedidosBase: number;
  pedidosVarPct: number | null;
  concentracaoTopGrupoPct: number;
}

export interface SerieMes {
  mes: string; // YYYY-MM
  valor: number;
  qtde: number;
  pedidos: number;
}

export interface RankingItem {
  key: string;
  label: string;
  valor: number;
  qtde: number;
  pedidos: number;
  valorVarPct?: number | null;
}

export interface GanhadorPerdedor {
  codigoProduto: string;
  descricaoProduto: string;
  grupoProduto: string;
  valor: number;
  valorBase: number;
  valorVarPct: number | null;
}

export interface PainelComercialVendasAnalyticsDto {
  filtros: { dataIni: string; dataFim: string; comparacaoBase: ComparacaoBase };
  kpis: PainelComercialVendasKpis;
  serieMensal: SerieMes[];
  topGrupos: RankingItem[];
  topSubgrupo1: RankingItem[];
  topVendedores: RankingItem[];
  topRegioes: RankingItem[];
  mixGrupos: { grupoProduto: string; valor: number; pct: number }[];
  ganhadores: GanhadorPerdedor[];
  perdedores: GanhadorPerdedor[];
  erro?: string;
}

export interface DrillBreakdownItem {
  key: string;
  label: string;
  valor: number;
  qtde: number;
  pedidos: number;
}

type CacheEntry = { ts: number; rows: VendaPainelRow[] };
const CACHE_TTL_MS = 120_000;
const baseCache = new Map<string, CacheEntry>();

function cacheKey(dataIni: string, dataFim: string): string {
  return `${dataIni}__${dataFim}`;
}

function mapRow(r: Record<string, unknown>): VendaPainelRow {
  return {
    pdId: toNum(r.pdId),
    pdCodigo: toStr(r.pdCodigo) || '—',
    dataEmissao: toStr(r.dataEmissao) || '—',
    mes: toStr(r.mes) || '—',
    cliente: toStr(r.cliente) || '—',
    vendedor: toStr(r.vendedor) || '—',
    uf: toStr(r.uf) || '—',
    municipio: toStr(r.municipio) || '—',
    regiao: toStr(r.regiao) || '—',
    codigoProduto: toStr(r.codigoProduto) || '—',
    descricaoProduto: toStr(r.descricaoProduto) || '—',
    grupoProduto: toStr(r.grupoProduto) || '—',
    subgrupo1: toStr(r.subgrupo1) || '—',
    subgrupo2: toStr(r.subgrupo2) || '—',
    qtdeVendida: toNum(r.qtdeVendida),
    valorVendido: toNum(r.valorVendido),
  };
}

async function carregarBasePeriodo(dataIni: string, dataFim: string): Promise<{ rows: VendaPainelRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { rows: [], erro: 'NOMUS_DB_URL não configurado ou pool indisponível.' };

  const ini = clampYmd(dataIni);
  const fim = clampYmd(dataFim);
  if (!ini || !fim) return { rows: [], erro: 'Datas inválidas.' };

  const k = cacheKey(ini, fim);
  const cached = baseCache.get(k);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) return { rows: cached.rows };

  let sql: string;
  try {
    sql = readFileSync(resolveSqlPath(SQL_FILE), 'utf-8').trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], erro: msg };
  }

  sql = sql.replace(/__DATA_INI__/g, ini).replace(/__DATA_FIM__/g, fim);

  let raw: Record<string, unknown>[];
  try {
    const [r] = await pool.query(sql);
    raw = (Array.isArray(r) ? r : []) as Record<string, unknown>[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], erro: msg };
  }

  const rows = raw.map(mapRow);
  baseCache.set(k, { ts: now, rows });
  return { rows };
}

function aplicarFiltrosInMemory(rows: VendaPainelRow[], f: Partial<FiltrosPainelComercialVendas>): VendaPainelRow[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const eq = (a: string, b: string) => norm(a) === norm(b);
  const includes = (a: string, b: string) => norm(a).includes(norm(b));

  return rows.filter((r) => {
    if (f.pd && !includes(r.pdCodigo, f.pd)) return false;
    if (f.grupoProduto && !includes(r.grupoProduto, f.grupoProduto)) return false;
    if (f.subgrupo1 && !includes(r.subgrupo1, f.subgrupo1)) return false;
    if (f.subgrupo2 && !includes(r.subgrupo2, f.subgrupo2)) return false;
    if (f.vendedor && !includes(r.vendedor, f.vendedor)) return false;
    if (f.regiao && !includes(r.regiao, f.regiao)) return false;
    if (f.uf && !eq(r.uf, f.uf)) return false;
    if (f.municipio && !includes(r.municipio, f.municipio)) return false;
    if (f.cliente && !includes(r.cliente, f.cliente)) return false;
    if (f.produto && !(includes(r.codigoProduto, f.produto) || includes(r.descricaoProduto, f.produto))) return false;
    return true;
  });
}

function aggregate(rows: VendaPainelRow[]): { valor: number; qtde: number; pedidos: number; pedidosSet: Set<number> } {
  let valor = 0;
  let qtde = 0;
  const pds = new Set<number>();
  for (const r of rows) {
    valor += r.valorVendido;
    qtde += r.qtdeVendida;
    if (r.pdId > 0) pds.add(r.pdId);
  }
  return { valor, qtde, pedidos: pds.size, pedidosSet: pds };
}

function groupBy(rows: VendaPainelRow[], dim: DrillDim): Map<string, VendaPainelRow[]> {
  const map = new Map<string, VendaPainelRow[]>();
  for (const r of rows) {
    let k = '';
    switch (dim) {
      case 'mes':
        k = r.mes;
        break;
      case 'grupo':
        k = r.grupoProduto;
        break;
      case 'subgrupo1':
        k = r.subgrupo1;
        break;
      case 'subgrupo2':
        k = r.subgrupo2;
        break;
      case 'vendedor':
        k = r.vendedor;
        break;
      case 'regiao':
        k = r.regiao;
        break;
      case 'uf':
        k = r.uf;
        break;
      case 'municipio':
        k = r.municipio;
        break;
      case 'produto':
        k = `${r.codigoProduto} — ${r.descricaoProduto}`.trim();
        break;
      case 'cliente':
        k = r.cliente;
        break;
      default:
        k = '—';
        break;
    }
    const cur = map.get(k) ?? [];
    cur.push(r);
    map.set(k, cur);
  }
  return map;
}

function serieMensal(rows: VendaPainelRow[]): SerieMes[] {
  const map = new Map<string, { valor: number; qtde: number; pds: Set<number> }>();
  for (const r of rows) {
    const key = r.mes || '—';
    const cur = map.get(key) ?? { valor: 0, qtde: 0, pds: new Set<number>() };
    cur.valor += r.valorVendido;
    cur.qtde += r.qtdeVendida;
    if (r.pdId > 0) cur.pds.add(r.pdId);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([mes, v]) => ({ mes, valor: v.valor, qtde: v.qtde, pedidos: v.pds.size }))
    .sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
}

function topRanking(rows: VendaPainelRow[], dim: DrillDim, limit: number, baseRows?: VendaPainelRow[]): RankingItem[] {
  const grouped = groupBy(rows, dim);
  const baseGrouped = baseRows ? groupBy(baseRows, dim) : null;

  const items: RankingItem[] = [];
  for (const [key, rws] of grouped.entries()) {
    const a = aggregate(rws);
    const baseAgg = baseGrouped?.get(key) ? aggregate(baseGrouped.get(key)!) : null;
    items.push({
      key,
      label: key,
      valor: a.valor,
      qtde: a.qtde,
      pedidos: a.pedidos,
      valorVarPct: baseAgg ? pctChange(a.valor, baseAgg.valor) : undefined,
    });
  }
  return items.sort((a, b) => b.valor - a.valor).slice(0, limit);
}

function mixPorGrupo(rows: VendaPainelRow[], limit: number): { grupoProduto: string; valor: number; pct: number }[] {
  const grouped = groupBy(rows, 'grupo');
  const total = rows.reduce((s, r) => s + r.valorVendido, 0);
  const items = [...grouped.entries()]
    .map(([grupoProduto, rws]) => ({ grupoProduto, valor: aggregate(rws).valor }))
    .sort((a, b) => b.valor - a.valor);

  const top = items.slice(0, limit);
  const outrosValor = items.slice(limit).reduce((s, x) => s + x.valor, 0);
  const withOutros = outrosValor > 0 ? [...top, { grupoProduto: 'Outros', valor: outrosValor }] : top;

  return withOutros.map((x) => ({ ...x, pct: total > 0 ? Math.round((x.valor / total) * 1000) / 10 : 0 }));
}

function winnersLosersPorProduto(rows: VendaPainelRow[], baseRows: VendaPainelRow[], limit: number): { ganhadores: GanhadorPerdedor[]; perdedores: GanhadorPerdedor[] } {
  const cur = new Map<string, { r: VendaPainelRow; valor: number }>();
  const base = new Map<string, number>();

  for (const r of rows) {
    const k = r.codigoProduto || '—';
    const c = cur.get(k) ?? { r, valor: 0 };
    c.valor += r.valorVendido;
    cur.set(k, c);
  }
  for (const r of baseRows) {
    const k = r.codigoProduto || '—';
    base.set(k, (base.get(k) ?? 0) + r.valorVendido);
  }

  const all: GanhadorPerdedor[] = [];
  for (const [codigoProduto, v] of cur.entries()) {
    const valorBase = base.get(codigoProduto) ?? 0;
    const valor = v.valor;
    all.push({
      codigoProduto,
      descricaoProduto: v.r.descricaoProduto,
      grupoProduto: v.r.grupoProduto,
      valor,
      valorBase,
      valorVarPct: pctChange(valor, valorBase),
    });
  }

  const sortable = all.filter((x) => x.valorVarPct !== null);
  const ganhadores = [...sortable].sort((a, b) => (b.valorVarPct! - a.valorVarPct!)).slice(0, limit);
  const perdedores = [...sortable].sort((a, b) => (a.valorVarPct! - b.valorVarPct!)).slice(0, limit);
  return { ganhadores, perdedores };
}

function periodoComparacao(dataIni: string, dataFim: string, base: ComparacaoBase): { dataIni: string; dataFim: string } | null {
  const ini = new Date(`${dataIni}T12:00:00`);
  const fim = new Date(`${dataFim}T12:00:00`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return null;
  if (base === 'ano_anterior') {
    ini.setFullYear(ini.getFullYear() - 1);
    fim.setFullYear(fim.getFullYear() - 1);
  } else {
    const dur = fim.getTime() - ini.getTime();
    const newFim = new Date(ini.getTime() - 24 * 60 * 60 * 1000);
    const newIni = new Date(newFim.getTime() - dur);
    return { dataIni: toLocalYmd(newIni), dataFim: toLocalYmd(newFim) };
  }
  return { dataIni: toLocalYmd(ini), dataFim: toLocalYmd(fim) };
}

export async function obterPainelComercialVendasAnalytics(
  filtros: FiltrosPainelComercialVendas
): Promise<PainelComercialVendasAnalyticsDto> {
  const comparacaoBase: ComparacaoBase = filtros.comparacaoBase ?? 'ano_anterior';
  const ini = clampYmd(filtros.dataIni) ?? '';
  const fim = clampYmd(filtros.dataFim) ?? '';
  const empty: PainelComercialVendasAnalyticsDto = {
    filtros: { dataIni: ini, dataFim: fim, comparacaoBase },
    kpis: {
      valor: 0,
      valorBase: 0,
      valorVarPct: 0,
      qtde: 0,
      qtdeBase: 0,
      qtdeVarPct: 0,
      ticketMedio: 0,
      ticketMedioBase: 0,
      ticketMedioVarPct: 0,
      pedidos: 0,
      pedidosBase: 0,
      pedidosVarPct: 0,
      concentracaoTopGrupoPct: 0,
    },
    serieMensal: [],
    topGrupos: [],
    topSubgrupo1: [],
    topVendedores: [],
    topRegioes: [],
    mixGrupos: [],
    ganhadores: [],
    perdedores: [],
  };

  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return { ...empty, erro: cur.erro };
  const curRows = aplicarFiltrosInMemory(cur.rows, filtros);

  const comp = periodoComparacao(filtros.dataIni, filtros.dataFim, comparacaoBase);
  let baseRows: VendaPainelRow[] = [];
  if (comp) {
    const base = await carregarBasePeriodo(comp.dataIni, comp.dataFim);
    if (!base.erro) baseRows = aplicarFiltrosInMemory(base.rows, filtros);
  }

  const aCur = aggregate(curRows);
  const aBase = aggregate(baseRows);

  const ticketCur = aCur.pedidos > 0 ? aCur.valor / aCur.pedidos : 0;
  const ticketBase = aBase.pedidos > 0 ? aBase.valor / aBase.pedidos : 0;

  const topGrupo = topRanking(curRows, 'grupo', 1)[0];
  const concentracaoTopGrupoPct = aCur.valor > 0 && topGrupo ? Math.round((topGrupo.valor / aCur.valor) * 1000) / 10 : 0;

  return {
    ...empty,
    kpis: {
      valor: aCur.valor,
      valorBase: aBase.valor,
      valorVarPct: pctChange(aCur.valor, aBase.valor),
      qtde: aCur.qtde,
      qtdeBase: aBase.qtde,
      qtdeVarPct: pctChange(aCur.qtde, aBase.qtde),
      ticketMedio: ticketCur,
      ticketMedioBase: ticketBase,
      ticketMedioVarPct: pctChange(ticketCur, ticketBase),
      pedidos: aCur.pedidos,
      pedidosBase: aBase.pedidos,
      pedidosVarPct: pctChange(aCur.pedidos, aBase.pedidos),
      concentracaoTopGrupoPct,
    },
    serieMensal: serieMensal(curRows),
    topGrupos: topRanking(curRows, 'grupo', 12, baseRows),
    topSubgrupo1: topRanking(curRows, 'subgrupo1', 12, baseRows),
    topVendedores: topRanking(curRows, 'vendedor', 12, baseRows),
    topRegioes: topRanking(curRows, 'regiao', 12, baseRows),
    mixGrupos: mixPorGrupo(curRows, 6),
    ...winnersLosersPorProduto(curRows, baseRows, 10),
  };
}

export async function obterPainelComercialVendasDrill(
  filtros: FiltrosPainelComercialVendas,
  ctx: DrillContexto
): Promise<DrillBreakdownItem[]> {
  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return [];
  let rows = aplicarFiltrosInMemory(cur.rows, filtros);

  if (ctx.where) {
    rows = rows.filter((r) => {
      if (ctx.where?.mes && r.mes !== ctx.where.mes) return false;
      if (ctx.where?.grupoProduto && r.grupoProduto !== ctx.where.grupoProduto) return false;
      if (ctx.where?.subgrupo1 && r.subgrupo1 !== ctx.where.subgrupo1) return false;
      if (ctx.where?.subgrupo2 && r.subgrupo2 !== ctx.where.subgrupo2) return false;
      if (ctx.where?.vendedor && r.vendedor !== ctx.where.vendedor) return false;
      if (ctx.where?.regiao && r.regiao !== ctx.where.regiao) return false;
      if (ctx.where?.uf && r.uf !== ctx.where.uf) return false;
      if (ctx.where?.municipio && r.municipio !== ctx.where.municipio) return false;
      if (ctx.where?.codigoProduto && r.codigoProduto !== ctx.where.codigoProduto) return false;
      if (ctx.where?.cliente && r.cliente !== ctx.where.cliente) return false;
      if (ctx.where?.pdCodigo && r.pdCodigo !== ctx.where.pdCodigo) return false;
      return true;
    });
  }

  const grouped = groupBy(
    rows,
    ctx.dim === 'grupo' ? 'grupo' : ctx.dim === 'subgrupo1' ? 'subgrupo1' : ctx.dim === 'subgrupo2' ? 'subgrupo2' : ctx.dim
  );

  const items = [...grouped.entries()].map(([key, rws]) => {
    const a = aggregate(rws);
    return { key, label: key, valor: a.valor, qtde: a.qtde, pedidos: a.pedidos };
  });

  return items.sort((a, b) => b.valor - a.valor).slice(0, 40);
}

export async function listarPainelComercialVendasDetalhe(
  filtros: FiltrosPainelComercialVendas,
  ctx?: DrillContexto
): Promise<{ rows: VendaPainelRow[]; erro?: string }> {
  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return { rows: [], erro: cur.erro };
  let rows = aplicarFiltrosInMemory(cur.rows, filtros);

  if (ctx?.where) {
    rows = rows.filter((r) => {
      if (ctx.where?.mes && r.mes !== ctx.where.mes) return false;
      if (ctx.where?.grupoProduto && r.grupoProduto !== ctx.where.grupoProduto) return false;
      if (ctx.where?.subgrupo1 && r.subgrupo1 !== ctx.where.subgrupo1) return false;
      if (ctx.where?.subgrupo2 && r.subgrupo2 !== ctx.where.subgrupo2) return false;
      if (ctx.where?.vendedor && r.vendedor !== ctx.where.vendedor) return false;
      if (ctx.where?.regiao && r.regiao !== ctx.where.regiao) return false;
      if (ctx.where?.uf && r.uf !== ctx.where.uf) return false;
      if (ctx.where?.municipio && r.municipio !== ctx.where.municipio) return false;
      if (ctx.where?.codigoProduto && r.codigoProduto !== ctx.where.codigoProduto) return false;
      if (ctx.where?.cliente && r.cliente !== ctx.where.cliente) return false;
      if (ctx.where?.pdCodigo && r.pdCodigo !== ctx.where.pdCodigo) return false;
      return true;
    });
  }

  return { rows };
}

