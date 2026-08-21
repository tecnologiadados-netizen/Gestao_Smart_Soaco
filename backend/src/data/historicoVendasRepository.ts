/**
 * Histórico de Vendas — leitura Nomus (MySQL) e agregações em memória.
 * Escopo: Só Aço (idEmpresa = 1). Inclui encerradas; exclui canceladas (status 6).
 * Janela máxima: 48 meses por data de emissão.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = 'sqlHistoricoVendasNomus.sql';
export const HISTORICO_VENDAS_MAX_MESES = 48;

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

/** Diferença em meses calendário aproximada (ini → fim inclusive-ish). */
export function mesesEntreYmd(dataIni: string, dataFim: string): number | null {
  const ini = clampYmd(dataIni);
  const fim = clampYmd(dataFim);
  if (!ini || !fim) return null;
  const dIni = new Date(`${ini}T12:00:00`);
  const dFim = new Date(`${fim}T12:00:00`);
  if (Number.isNaN(dIni.getTime()) || Number.isNaN(dFim.getTime())) return null;
  if (dFim < dIni) return null;
  return (dFim.getFullYear() - dIni.getFullYear()) * 12 + (dFim.getMonth() - dIni.getMonth());
}

export function validarPeriodoMaximo(dataIni: string, dataFim: string): string | null {
  const meses = mesesEntreYmd(dataIni, dataFim);
  if (meses == null) return 'Datas inválidas.';
  if (meses > HISTORICO_VENDAS_MAX_MESES) {
    return `Período máximo permitido: ${HISTORICO_VENDAS_MAX_MESES} meses.`;
  }
  return null;
}

export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';

export interface FiltrosHistoricoVendas {
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

export interface VendaHistoricoRow {
  pdId: number;
  pdCodigo: string;
  dataEmissao: string;
  mes: string;
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
  where?: Partial<
    Pick<
      VendaHistoricoRow,
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
    >
  >;
}

export interface SerieFatiaContexto {
  where?: DrillContexto['where'];
}

export interface HistoricoVendasKpis {
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
  mes: string;
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

export interface HistoricoVendasAnalyticsDto {
  filtros: { dataIni: string; dataFim: string; comparacaoBase: ComparacaoBase };
  kpis: HistoricoVendasKpis;
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

type CacheEntry = { ts: number; rows: VendaHistoricoRow[] };
const CACHE_TTL_MS = 120_000;
const baseCache = new Map<string, CacheEntry>();

function cacheKey(dataIni: string, dataFim: string): string {
  return `${dataIni}__${dataFim}`;
}

function mapRow(r: Record<string, unknown>): VendaHistoricoRow {
  return {
    pdId: toNum(r.pdId),
    pdCodigo: toStr(r.pdCodigo) || '—',
    dataEmissao: normalizeEmissaoYmd(r.dataEmissao) ?? '—',
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

async function carregarBasePeriodo(dataIni: string, dataFim: string): Promise<{ rows: VendaHistoricoRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { rows: [], erro: 'NOMUS_DB_URL não configurado ou pool indisponível.' };

  const ini = clampYmd(dataIni);
  const fim = clampYmd(dataFim);
  if (!ini || !fim) return { rows: [], erro: 'Datas inválidas.' };

  const periodoErro = validarPeriodoMaximo(ini, fim);
  if (periodoErro) return { rows: [], erro: periodoErro };

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

function matchFiltroCampo(
  valor: string,
  filtro: string | undefined,
  mode: 'eq' | 'includes'
): boolean {
  const raw = String(filtro ?? '').trim();
  if (!raw) return true;
  const norm = (s: string) => s.trim().toLowerCase();
  const eq = (a: string, b: string) => norm(a) === norm(b);
  const includes = (a: string, b: string) => norm(a).includes(norm(b));
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length === 1) {
    const p = parts[0]!;
    return mode === 'eq' ? eq(valor, p) : includes(valor, p);
  }
  return parts.some((p) => eq(valor, p));
}

function aplicarFiltrosInMemory(rows: VendaHistoricoRow[], f: Partial<FiltrosHistoricoVendas>): VendaHistoricoRow[] {
  return rows.filter((r) => {
    if (f.pd && !matchFiltroCampo(r.pdCodigo, f.pd, 'includes')) return false;
    if (f.grupoProduto && !matchFiltroCampo(r.grupoProduto, f.grupoProduto, 'includes')) return false;
    if (f.subgrupo1 && !matchFiltroCampo(r.subgrupo1, f.subgrupo1, 'includes')) return false;
    if (f.subgrupo2 && !matchFiltroCampo(r.subgrupo2, f.subgrupo2, 'includes')) return false;
    if (f.vendedor && !matchFiltroCampo(r.vendedor, f.vendedor, 'includes')) return false;
    if (f.regiao && !matchFiltroCampo(r.regiao, f.regiao, 'includes')) return false;
    if (f.uf && !matchFiltroCampo(r.uf, f.uf, 'eq')) return false;
    if (f.municipio && !matchFiltroCampo(r.municipio, f.municipio, 'includes')) return false;
    if (f.cliente && !matchFiltroCampo(r.cliente, f.cliente, 'includes')) return false;
    if (
      f.produto &&
      !matchFiltroCampo(r.codigoProduto, f.produto, 'includes') &&
      !matchFiltroCampo(r.descricaoProduto, f.produto, 'includes')
    ) {
      return false;
    }
    return true;
  });
}

function aplicarWhereExato(rows: VendaHistoricoRow[], where?: DrillContexto['where']): VendaHistoricoRow[] {
  if (!where) return rows;
  return rows.filter((r) => {
    if (where.mes && r.mes !== where.mes) return false;
    if (where.grupoProduto && r.grupoProduto !== where.grupoProduto) return false;
    if (where.subgrupo1 && r.subgrupo1 !== where.subgrupo1) return false;
    if (where.subgrupo2 && r.subgrupo2 !== where.subgrupo2) return false;
    if (where.vendedor && r.vendedor !== where.vendedor) return false;
    if (where.regiao && r.regiao !== where.regiao) return false;
    if (where.uf && r.uf !== where.uf) return false;
    if (where.municipio && r.municipio !== where.municipio) return false;
    if (where.codigoProduto && r.codigoProduto !== where.codigoProduto) return false;
    if (where.cliente && r.cliente !== where.cliente) return false;
    if (where.pdCodigo && r.pdCodigo !== where.pdCodigo) return false;
    return true;
  });
}

function aggregate(rows: VendaHistoricoRow[]): { valor: number; qtde: number; pedidos: number; pedidosSet: Set<number> } {
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

function groupBy(rows: VendaHistoricoRow[], dim: DrillDim): Map<string, VendaHistoricoRow[]> {
  const map = new Map<string, VendaHistoricoRow[]>();
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

function serieMensal(rows: VendaHistoricoRow[]): SerieMes[] {
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

function topRanking(rows: VendaHistoricoRow[], dim: DrillDim, limit: number, baseRows?: VendaHistoricoRow[]): RankingItem[] {
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

function mixPorGrupo(rows: VendaHistoricoRow[], limit: number): { grupoProduto: string; valor: number; pct: number }[] {
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

function winnersLosersPorProduto(
  rows: VendaHistoricoRow[],
  baseRows: VendaHistoricoRow[],
  limit: number
): { ganhadores: GanhadorPerdedor[]; perdedores: GanhadorPerdedor[] } {
  const cur = new Map<string, { r: VendaHistoricoRow; valor: number }>();
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
  const ganhadores = [...sortable].sort((a, b) => b.valorVarPct! - a.valorVarPct!).slice(0, limit);
  const perdedores = [...sortable].sort((a, b) => a.valorVarPct! - b.valorVarPct!).slice(0, limit);
  return { ganhadores, perdedores };
}

export async function carregarHistoricoVendasBasePeriodo(
  dataIni: string,
  dataFim: string
): Promise<{ rows: VendaHistoricoRow[]; erro?: string }> {
  const periodoErro = validarPeriodoMaximo(dataIni, dataFim);
  if (periodoErro) return { rows: [], erro: periodoErro };
  return carregarBasePeriodo(dataIni, dataFim);
}

export function extrairOpcoesFiltroHistorico(rows: VendaHistoricoRow[]): {
  municipios: string[];
  ufs: string[];
  vendedores: string[];
  regioes: string[];
  gruposProduto: string[];
} {
  const sortPt = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
  const uniq = (fn: (r: VendaHistoricoRow) => string) => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = fn(r).trim();
      if (v) set.add(v);
    }
    return [...set].sort(sortPt);
  };
  return {
    municipios: uniq((r) => r.municipio),
    ufs: uniq((r) => r.uf),
    vendedores: uniq((r) => r.vendedor),
    regioes: uniq((r) => r.regiao),
    gruposProduto: uniq((r) => r.grupoProduto),
  };
}

export function periodoDadosEmissao(rows: VendaHistoricoRow[]): { dataIni: string; dataFim: string } | null {
  if (!rows.length) return null;
  let minMs = Infinity;
  let maxMs = -Infinity;
  let minYmd = '';
  let maxYmd = '';
  for (const r of rows) {
    const ymd = normalizeEmissaoYmd(r.dataEmissao);
    if (!ymd) continue;
    const ms = new Date(`${ymd}T12:00:00`).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms < minMs) {
      minMs = ms;
      minYmd = ymd;
    }
    if (ms > maxMs) {
      maxMs = ms;
      maxYmd = ymd;
    }
  }
  return minYmd && maxYmd ? { dataIni: minYmd, dataFim: maxYmd } : null;
}

function normalizeEmissaoYmd(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toLocalYmd(v);
  }
  const raw = String(v ?? '').trim();
  if (!raw || raw === '—') return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (iso) return iso[1]!;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return toLocalYmd(d);
  return null;
}

export { normalizeEmissaoYmd };

export async function carregarHistoricoVendasFiltrado(
  filtros: FiltrosHistoricoVendas
): Promise<{ rows: VendaHistoricoRow[]; erro?: string }> {
  const periodoErro = validarPeriodoMaximo(filtros.dataIni, filtros.dataFim);
  if (periodoErro) return { rows: [], erro: periodoErro };
  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return { rows: [], erro: cur.erro };
  return { rows: aplicarFiltrosInMemory(cur.rows, filtros) };
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

function emptyAnalytics(ini: string, fim: string, comparacaoBase: ComparacaoBase): HistoricoVendasAnalyticsDto {
  return {
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
}

export async function obterHistoricoVendasAnalytics(filtros: FiltrosHistoricoVendas): Promise<HistoricoVendasAnalyticsDto> {
  const comparacaoBase: ComparacaoBase = filtros.comparacaoBase ?? 'ano_anterior';
  const ini = clampYmd(filtros.dataIni) ?? '';
  const fim = clampYmd(filtros.dataFim) ?? '';
  const empty = emptyAnalytics(ini, fim, comparacaoBase);

  const periodoErro = validarPeriodoMaximo(filtros.dataIni, filtros.dataFim);
  if (periodoErro) return { ...empty, erro: periodoErro };

  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return { ...empty, erro: cur.erro };
  const curRows = aplicarFiltrosInMemory(cur.rows, filtros);

  const comp = periodoComparacao(filtros.dataIni, filtros.dataFim, comparacaoBase);
  let baseRows: VendaHistoricoRow[] = [];
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

export async function obterHistoricoVendasDrill(
  filtros: FiltrosHistoricoVendas,
  ctx: DrillContexto
): Promise<DrillBreakdownItem[]> {
  const periodoErro = validarPeriodoMaximo(filtros.dataIni, filtros.dataFim);
  if (periodoErro) return [];

  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return [];
  let rows = aplicarFiltrosInMemory(cur.rows, filtros);
  rows = aplicarWhereExato(rows, ctx.where);

  const grouped = groupBy(rows, ctx.dim);

  const items = [...grouped.entries()].map(([key, rws]) => {
    const a = aggregate(rws);
    return { key, label: key, valor: a.valor, qtde: a.qtde, pedidos: a.pedidos };
  });

  return items.sort((a, b) => b.valor - a.valor).slice(0, 40);
}

export async function obterHistoricoVendasSerieFatia(
  filtros: FiltrosHistoricoVendas,
  ctx?: SerieFatiaContexto
): Promise<{ serieMensal: SerieMes[]; erro?: string }> {
  const periodoErro = validarPeriodoMaximo(filtros.dataIni, filtros.dataFim);
  if (periodoErro) return { serieMensal: [], erro: periodoErro };

  const cur = await carregarBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (cur.erro) return { serieMensal: [], erro: cur.erro };

  let rows = aplicarFiltrosInMemory(cur.rows, filtros);
  rows = aplicarWhereExato(rows, ctx?.where);

  return { serieMensal: serieMensal(rows) };
}
