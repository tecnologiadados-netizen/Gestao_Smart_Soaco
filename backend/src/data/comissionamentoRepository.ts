/**
 * Análise de Comissionamento — Nomus (itempedido) + classificação de equipes em SQLite Config.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { prisma } from '../config/prisma.js';
import { enriquecerLinhasComCusto } from './comissionamentoCustoService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = 'sqlComissionamentoNomus.sql';
const CONFIG_KEY = 'comissionamento_equipes_v1';
export const COMISSIONAMENTO_MAX_MESES = 48;

export type EquipeComissionamento = 'televendas' | 'vendedores' | 'representantes' | 'sem_equipe';
export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';

export const EQUIPE_LABEL: Record<EquipeComissionamento, string> = {
  televendas: 'Televendas',
  vendedores: 'Vendedores',
  representantes: 'Representantes',
  sem_equipe: 'Sem equipe',
};

function resolveSqlPath(fileName: string): string {
  const candidates = [
    join(__dirname, fileName),
    join(process.cwd(), 'src', 'data', fileName),
    join(process.cwd(), 'dist', 'data', fileName),
  ];
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

function mesesEntreYmd(dataIni: string, dataFim: string): number | null {
  const ini = clampYmd(dataIni);
  const fim = clampYmd(dataFim);
  if (!ini || !fim) return null;
  const dIni = new Date(`${ini}T12:00:00`);
  const dFim = new Date(`${fim}T12:00:00`);
  if (Number.isNaN(dIni.getTime()) || Number.isNaN(dFim.getTime())) return null;
  if (dFim < dIni) return null;
  return (dFim.getFullYear() - dIni.getFullYear()) * 12 + (dFim.getMonth() - dIni.getMonth());
}

export function validarPeriodoComissionamento(dataIni: string, dataFim: string): string | null {
  const meses = mesesEntreYmd(dataIni, dataFim);
  if (meses == null) return 'Datas inválidas.';
  if (meses > COMISSIONAMENTO_MAX_MESES) {
    return `Período máximo permitido: ${COMISSIONAMENTO_MAX_MESES} meses.`;
  }
  return null;
}

function shiftPeriodo(
  dataIni: string,
  dataFim: string,
  base: ComparacaoBase
): { dataIni: string; dataFim: string } | null {
  const ini = clampYmd(dataIni);
  const fim = clampYmd(dataFim);
  if (!ini || !fim) return null;
  const dIni = new Date(`${ini}T12:00:00`);
  const dFim = new Date(`${fim}T12:00:00`);
  if (base === 'ano_anterior') {
    dIni.setFullYear(dIni.getFullYear() - 1);
    dFim.setFullYear(dFim.getFullYear() - 1);
  } else {
    const meses = mesesEntreYmd(ini, fim);
    if (meses == null) return null;
    const shift = meses + 1;
    dIni.setMonth(dIni.getMonth() - shift);
    dFim.setMonth(dFim.getMonth() - shift);
  }
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dataIni: ymd(dIni), dataFim: ymd(dFim) };
}

function mesAnoAnterior(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

function mesAnterior(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface FiltrosComissionamento {
  dataIni: string;
  dataFim: string;
  comparacaoBase?: ComparacaoBase;
  grupoProduto?: string;
  vendedor?: string;
  equipe?: EquipeComissionamento | string;
  status?: string;
  cliente?: string;
  produto?: string;
}

export interface ComissionamentoRow {
  idEmpresa: number;
  empresa: string;
  idItem: number;
  pdId: number;
  pdCodigo: string;
  dataEmissao: string;
  mes: string;
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  cliente: string;
  grupoProduto: string;
  qtde: number;
  precoUnitario: number;
  valorTotal: number;
  valorDesconto: number;
  valorVendido: number;
  vendedor: string;
  status: string;
  requisicao: string;
  equipe: EquipeComissionamento;
  /** Custo DRE (BOM + médio mensal), sem MKP. */
  custoUnitario?: number | null;
  custoTotal?: number | null;
  margem?: number | null;
  margemPct?: number | null;
}

export type ClassificacaoEquipesMap = Record<string, Exclude<EquipeComissionamento, 'sem_equipe'>>;

function normalizarNome(nome: string): string {
  return toStr(nome).toLocaleUpperCase('pt-BR');
}

export async function obterClassificacaoEquipes(): Promise<ClassificacaoEquipesMap> {
  const row = await prisma.config.findUnique({ where: { key: CONFIG_KEY } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as ClassificacaoEquipesMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ClassificacaoEquipesMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 'televendas' || v === 'vendedores' || v === 'representantes') {
        out[normalizarNome(k)] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function salvarClassificacaoEquipes(mapa: ClassificacaoEquipesMap): Promise<ClassificacaoEquipesMap> {
  const limpo: ClassificacaoEquipesMap = {};
  for (const [k, v] of Object.entries(mapa ?? {})) {
    const nome = normalizarNome(k);
    if (!nome) continue;
    if (v === 'televendas' || v === 'vendedores' || v === 'representantes') {
      limpo[nome] = v;
    }
  }
  const value = JSON.stringify(limpo);
  await prisma.config.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value },
    update: { value },
  });
  return limpo;
}

function resolverEquipe(vendedor: string, mapa: ClassificacaoEquipesMap): EquipeComissionamento {
  const key = normalizarNome(vendedor);
  if (!key || key === '—' || key === '-') return 'sem_equipe';
  return mapa[key] ?? 'sem_equipe';
}

let sqlCache: string | null = null;
function loadSql(): string {
  if (!sqlCache) sqlCache = readFileSync(resolveSqlPath(SQL_FILE), 'utf8');
  return sqlCache;
}

async function carregarLinhas(dataIni: string, dataFim: string, mapa: ClassificacaoEquipesMap): Promise<ComissionamentoRow[]> {
  if (!isNomusEnabled()) return [];
  const pool = getNomusPool();
  if (!pool) return [];
  const sql = loadSql().replace(/__DATA_INI__/g, dataIni).replace(/__DATA_FIM__/g, dataFim);
  const [rows] = await pool.query(sql);
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  return list.map((r) => {
    const vendedor = toStr(r.vendedor) || '—';
    return {
      idEmpresa: toNum(r.idEmpresa),
      empresa: toStr(r.empresa),
      idItem: toNum(r.idItem),
      pdId: toNum(r.pdId),
      pdCodigo: toStr(r.pdCodigo),
      dataEmissao: toStr(r.dataEmissao).slice(0, 10),
      mes: toStr(r.mes).slice(0, 7),
      idProduto: Math.trunc(toNum(r.idProduto)),
      codigoProduto: toStr(r.codigoProduto),
      descricaoProduto: toStr(r.descricaoProduto),
      cliente: toStr(r.cliente) || '—',
      grupoProduto: toStr(r.grupoProduto) || '—',
      qtde: toNum(r.qtde),
      precoUnitario: toNum(r.precoUnitario),
      valorTotal: toNum(r.valorTotal),
      valorDesconto: toNum(r.valorDesconto),
      valorVendido: toNum(r.valorVendido),
      vendedor,
      status: toStr(r.status) || 'Sem status',
      requisicao: toStr(r.requisicao),
      equipe: resolverEquipe(vendedor, mapa),
      custoUnitario: null,
      custoTotal: null,
      margem: null,
      margemPct: null,
    };
  });
}

/** Carrega vendas e aplica custo DRE (sem MKP) em uma passagem. */
async function carregarLinhasComCusto(
  dataIni: string,
  dataFim: string,
  mapa: ClassificacaoEquipesMap
): Promise<ComissionamentoRow[]> {
  const rows = await carregarLinhas(dataIni, dataFim, mapa);
  await enriquecerLinhasComCusto(rows, dataIni, dataFim);
  return rows;
}

function parseFiltroCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchFiltroCsv(valor: string, filtroCsv: string | undefined): boolean {
  const parts = parseFiltroCsv(filtroCsv);
  if (parts.length === 0) return true;
  return parts.includes(valor);
}

function aplicarFiltros(rows: ComissionamentoRow[], f: FiltrosComissionamento): ComissionamentoRow[] {
  return rows.filter((r) => {
    if (!matchFiltroCsv(r.grupoProduto, f.grupoProduto)) return false;
    if (!matchFiltroCsv(r.vendedor, f.vendedor)) return false;
    if (f.equipe && f.equipe !== 'todas' && !matchFiltroCsv(r.equipe, f.equipe)) return false;
    if (!matchFiltroCsv(r.status, f.status)) return false;
    if (!matchFiltroCsv(r.cliente, f.cliente)) return false;
    if (f.produto) {
      const parts = parseFiltroCsv(f.produto);
      if (
        parts.length > 0 &&
        !parts.some((p) => r.codigoProduto === p || r.descricaoProduto === p)
      ) {
        return false;
      }
    }
    return true;
  });
}

type AggKey = {
  valor: number;
  qtde: number;
  pedidos: Set<number>;
  clientes: Set<string>;
  produtos: Set<string>;
  desconto: number;
  bruto: number;
  custo: number;
  margem: number;
  valorComCusto: number;
  linhasComCusto: number;
};

function emptyAgg(): AggKey {
  return {
    valor: 0,
    qtde: 0,
    pedidos: new Set(),
    clientes: new Set(),
    produtos: new Set(),
    desconto: 0,
    bruto: 0,
    custo: 0,
    margem: 0,
    valorComCusto: 0,
    linhasComCusto: 0,
  };
}

function addAgg(a: AggKey, r: ComissionamentoRow) {
  a.valor += r.valorVendido;
  a.qtde += r.qtde;
  a.pedidos.add(r.pdId);
  a.clientes.add(r.cliente);
  a.produtos.add(r.codigoProduto || String(r.idItem));
  a.desconto += r.valorDesconto;
  a.bruto += r.valorTotal;
  if (r.custoTotal != null && Number.isFinite(r.custoTotal)) {
    a.custo += r.custoTotal;
    a.margem += r.margem ?? r.valorVendido - r.custoTotal;
    a.valorComCusto += r.valorVendido;
    a.linhasComCusto += 1;
  }
}

function margemPctAgg(a: AggKey): number | null {
  if (a.valorComCusto <= 0) return null;
  return Math.round((a.margem / a.valorComCusto) * 1000) / 10;
}

function rankingFromMap(
  map: Map<string, AggKey>,
  limit = 20
): Array<{
  key: string;
  label: string;
  valor: number;
  qtde: number;
  pedidos: number;
  clientes: number;
  custo: number;
  margem: number;
  margemPct: number | null;
}> {
  return [...map.entries()]
    .map(([key, a]) => ({
      key,
      label: key,
      valor: Math.round(a.valor * 100) / 100,
      qtde: Math.round(a.qtde * 1000) / 1000,
      pedidos: a.pedidos.size,
      clientes: a.clientes.size,
      custo: Math.round(a.custo * 100) / 100,
      margem: Math.round(a.margem * 100) / 100,
      margemPct: margemPctAgg(a),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

export async function listarPessoasComissionamento(filtros: FiltrosComissionamento): Promise<{
  pessoas: Array<{ nome: string; equipe: EquipeComissionamento; valor: number }>;
  classificacao: ClassificacaoEquipesMap;
  erro?: string;
}> {
  const errPeriodo = validarPeriodoComissionamento(filtros.dataIni, filtros.dataFim);
  if (errPeriodo) return { pessoas: [], classificacao: {}, erro: errPeriodo };
  if (!isNomusEnabled()) return { pessoas: [], classificacao: {}, erro: 'Nomus não configurado.' };
  const mapa = await obterClassificacaoEquipes();
  const rows = await carregarLinhas(filtros.dataIni, filtros.dataFim, mapa);
  const byVend = new Map<string, AggKey>();
  for (const r of rows) {
    if (!byVend.has(r.vendedor)) byVend.set(r.vendedor, emptyAgg());
    addAgg(byVend.get(r.vendedor)!, r);
  }
  const pessoas = [...byVend.entries()]
    .map(([nome, a]) => ({
      nome,
      equipe: resolverEquipe(nome, mapa),
      valor: Math.round(a.valor * 100) / 100,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { pessoas, classificacao: mapa };
}

export async function obterComissionamentoAnalytics(filtros: FiltrosComissionamento): Promise<{
  filtros: { dataIni: string; dataFim: string; comparacaoBase: ComparacaoBase };
  kpis: Record<string, number | null>;
  serieMensal: Array<{
    mes: string;
    valor: number;
    qtde: number;
    pedidos: number;
    valorAnoAnterior: number | null;
    varMomPct: number | null;
    varYoyPct: number | null;
    custo?: number;
    margem?: number;
    margemPct?: number | null;
  }>;
  mixGrupos: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    clientes: number;
    custo: number;
    margem: number;
    margemPct: number | null;
  }>;
  rankingVendedores: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    clientes: number;
    equipe: EquipeComissionamento;
    custo: number;
    margem: number;
    margemPct: number | null;
  }>;
  rankingEquipes: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    clientes: number;
    sharePct: number;
    custo: number;
    margem: number;
    margemPct: number | null;
  }>;
  rankingProdutosMargem: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    clientes: number;
    custo: number;
    margem: number;
    margemPct: number | null;
  }>;
  mixStatus: Array<{ key: string; label: string; valor: number; qtde: number; pedidos: number }>;
  paretoClientes: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    sharePct: number;
    acumuladoPct: number;
  }>;
  heatmapEquipeMes: Array<{ equipe: string; mes: string; valor: number }>;
  opcoes: {
    vendedores: string[];
    grupos: string[];
    status: string[];
    equipes: EquipeComissionamento[];
  };
  classificacao: ClassificacaoEquipesMap;
  erro?: string;
}> {
  const comparacaoBase: ComparacaoBase = filtros.comparacaoBase === 'periodo_anterior' ? 'periodo_anterior' : 'ano_anterior';
  const errPeriodo = validarPeriodoComissionamento(filtros.dataIni, filtros.dataFim);
  const empty = {
    filtros: { dataIni: filtros.dataIni, dataFim: filtros.dataFim, comparacaoBase },
    kpis: {
      valor: 0,
      valorBase: 0,
      valorVarPct: null as number | null,
      qtde: 0,
      pedidos: 0,
      clientes: 0,
      ticketMedio: 0,
      ticketMedioCliente: 0,
      positivacao: 0,
      coberturaPct: null as number | null,
      descontoMedioPct: null as number | null,
      itensPorPedido: 0,
      valorPorItem: 0,
      concentracaoTop20Pct: null as number | null,
      clientesNovos: 0,
      clientesRecorrentes: 0,
      custo: 0,
      margem: 0,
      margemPct: null as number | null,
      margemBase: 0,
      margemVarPct: null as number | null,
      coberturaCustoPct: null as number | null,
    },
    serieMensal: [],
    mixGrupos: [],
    rankingVendedores: [],
    rankingEquipes: [],
    rankingProdutosMargem: [],
    mixStatus: [],
    paretoClientes: [],
    heatmapEquipeMes: [],
    opcoes: { vendedores: [], grupos: [], status: [], equipes: ['televendas', 'vendedores', 'representantes', 'sem_equipe'] as EquipeComissionamento[] },
    classificacao: {} as ClassificacaoEquipesMap,
  };

  if (errPeriodo) return { ...empty, erro: errPeriodo };
  if (!isNomusEnabled()) return { ...empty, erro: 'Nomus não configurado.' };

  try {
    const mapa = await obterClassificacaoEquipes();
    const periodoBase = shiftPeriodo(filtros.dataIni, filtros.dataFim, comparacaoBase);

    const dIni = new Date(`${filtros.dataIni}T12:00:00`);
    dIni.setMonth(dIni.getMonth() - 12);
    const histIni = `${dIni.getFullYear()}-${String(dIni.getMonth() + 1).padStart(2, '0')}-${String(dIni.getDate()).padStart(2, '0')}`;

    const [rowsAtualRaw, rawBase, histRaw] = await Promise.all([
      carregarLinhas(filtros.dataIni, filtros.dataFim, mapa),
      periodoBase ? carregarLinhas(periodoBase.dataIni, periodoBase.dataFim, mapa) : Promise.resolve([] as ComissionamentoRow[]),
      carregarLinhas(histIni, filtros.dataIni, mapa),
    ]);

    const custoIni = periodoBase && periodoBase.dataIni < filtros.dataIni ? periodoBase.dataIni : filtros.dataIni;
    const custoFim = filtros.dataFim;
    await enriquecerLinhasComCusto([...rowsAtualRaw, ...rawBase], custoIni, custoFim);

    const rowsAtual = aplicarFiltros(rowsAtualRaw, filtros);
    const rowsBase = aplicarFiltros(rawBase, filtros);
    const clientesAntes = new Set(
      aplicarFiltros(histRaw, { ...filtros, dataIni: histIni, dataFim: filtros.dataIni }).map((r) => r.cliente)
    );

    const aggAtual = emptyAgg();
    const byMes = new Map<string, AggKey>();
    const byGrupo = new Map<string, AggKey>();
    const byVend = new Map<string, AggKey>();
    const byEquipe = new Map<string, AggKey>();
    const byStatus = new Map<string, AggKey>();
    const byCliente = new Map<string, AggKey>();
    const byProduto = new Map<string, AggKey>();
    const byProdutoLabel = new Map<string, string>();
    const heat = new Map<string, number>();
    const opVend = new Set<string>();
    const opGrupo = new Set<string>();
    const opStatus = new Set<string>();

    for (const r of rowsAtual) {
      addAgg(aggAtual, r);
      if (!byMes.has(r.mes)) byMes.set(r.mes, emptyAgg());
      addAgg(byMes.get(r.mes)!, r);
      if (!byGrupo.has(r.grupoProduto)) byGrupo.set(r.grupoProduto, emptyAgg());
      addAgg(byGrupo.get(r.grupoProduto)!, r);
      if (!byVend.has(r.vendedor)) byVend.set(r.vendedor, emptyAgg());
      addAgg(byVend.get(r.vendedor)!, r);
      if (!byEquipe.has(r.equipe)) byEquipe.set(r.equipe, emptyAgg());
      addAgg(byEquipe.get(r.equipe)!, r);
      if (!byStatus.has(r.status)) byStatus.set(r.status, emptyAgg());
      addAgg(byStatus.get(r.status)!, r);
      if (!byCliente.has(r.cliente)) byCliente.set(r.cliente, emptyAgg());
      addAgg(byCliente.get(r.cliente)!, r);
      const prodKey = r.codigoProduto || r.descricaoProduto || String(r.idProduto || r.idItem);
      if (!byProduto.has(prodKey)) {
        byProduto.set(prodKey, emptyAgg());
        byProdutoLabel.set(
          prodKey,
          r.descricaoProduto && r.codigoProduto
            ? `${r.codigoProduto} · ${r.descricaoProduto}`.slice(0, 80)
            : prodKey
        );
      }
      addAgg(byProduto.get(prodKey)!, r);
      const hk = `${r.equipe}|${r.mes}`;
      heat.set(hk, (heat.get(hk) ?? 0) + r.valorVendido);
      opVend.add(r.vendedor);
      opGrupo.add(r.grupoProduto);
      opStatus.add(r.status);
    }

    const aggBase = emptyAgg();
    const byMesBase = new Map<string, number>();
    for (const r of rowsBase) {
      addAgg(aggBase, r);
      byMesBase.set(r.mes, (byMesBase.get(r.mes) ?? 0) + r.valorVendido);
    }

    const mesesOrdenados = [...byMes.keys()].sort();
    const serieMensal = mesesOrdenados.map((mes) => {
      const a = byMes.get(mes)!;
      const mesYoy = mesAnoAnterior(mes);
      const valorYoy =
        comparacaoBase === 'ano_anterior'
          ? byMesBase.get(mesYoy) ?? null
          : byMesBase.get(mes) ?? null;
      let valorAnoAnterior: number | null = null;
      if (comparacaoBase === 'ano_anterior') {
        valorAnoAnterior = byMesBase.get(mesYoy) ?? 0;
      } else {
        valorAnoAnterior = null;
      }
      const mesMom = mesAnterior(mes);
      const valorMom = byMes.get(mesMom)?.valor ?? null;
      return {
        mes,
        valor: Math.round(a.valor * 100) / 100,
        qtde: Math.round(a.qtde * 1000) / 1000,
        pedidos: a.pedidos.size,
        valorAnoAnterior: valorAnoAnterior != null ? Math.round(valorAnoAnterior * 100) / 100 : null,
        varMomPct: valorMom != null ? pctChange(a.valor, valorMom) : null,
        varYoyPct: valorAnoAnterior != null ? pctChange(a.valor, valorAnoAnterior) : valorYoy != null ? pctChange(a.valor, valorYoy) : null,
        custo: Math.round(a.custo * 100) / 100,
        margem: Math.round(a.margem * 100) / 100,
        margemPct: margemPctAgg(a),
      };
    });

    const totalValor = aggAtual.valor;
    const rankingEquipesRaw = rankingFromMap(byEquipe, 10).map((x) => ({
      ...x,
      label: EQUIPE_LABEL[x.key as EquipeComissionamento] ?? x.key,
      sharePct: totalValor > 0 ? Math.round((x.valor / totalValor) * 1000) / 10 : 0,
    }));

    const rankingVendedores = rankingFromMap(byVend, 30).map((x) => ({
      ...x,
      equipe: resolverEquipe(x.key, mapa),
    }));

    const rankingProdutosMargem = rankingFromMap(byProduto, 40)
      .filter((x) => x.custo > 0)
      .sort((a, b) => b.margem - a.margem)
      .slice(0, 25)
      .map((x) => ({
        ...x,
        label: byProdutoLabel.get(x.key) ?? x.label,
      }));

    const sortedVendVal = rankingVendedores.map((v) => v.valor);
    const nTop = Math.max(1, Math.ceil(sortedVendVal.length * 0.2));
    const topSum = sortedVendVal.slice(0, nTop).reduce((s, v) => s + v, 0);
    const concentracaoTop20Pct = totalValor > 0 ? Math.round((topSum / totalValor) * 1000) / 10 : null;

    const rankingClientesRaw = rankingFromMap(byCliente, 40);
    let acumClientes = 0;
    const paretoClientes = rankingClientesRaw.map((x) => {
      const sharePct = totalValor > 0 ? (x.valor / totalValor) * 100 : 0;
      acumClientes += sharePct;
      return {
        key: x.key,
        label: x.label,
        valor: x.valor,
        qtde: x.qtde,
        pedidos: x.pedidos,
        sharePct: Math.round(sharePct * 10) / 10,
        acumuladoPct: Math.round(Math.min(100, acumClientes) * 10) / 10,
      };
    });

    const clientesPeriodo = aggAtual.clientes;
    let clientesNovos = 0;
    let clientesRecorrentes = 0;
    for (const c of clientesPeriodo) {
      if (clientesAntes.has(c)) clientesRecorrentes += 1;
      else clientesNovos += 1;
    }

    const gruposUniverso = new Set(rowsAtualRaw.map((r) => r.grupoProduto));
    const gruposComVenda = byGrupo.size;
    const coberturaPct =
      gruposUniverso.size > 0 ? Math.round((gruposComVenda / gruposUniverso.size) * 1000) / 10 : null;

    const pedidos = aggAtual.pedidos.size;
    const ticketMedio = pedidos > 0 ? totalValor / pedidos : 0;
    const ticketMedioCliente = clientesPeriodo.size > 0 ? totalValor / clientesPeriodo.size : 0;
    const descontoMedioPct =
      aggAtual.bruto > 0 ? Math.round((aggAtual.desconto / aggAtual.bruto) * 1000) / 10 : null;
    const itensLinha = rowsAtual.length;
    const itensPorPedido = pedidos > 0 ? Math.round((itensLinha / pedidos) * 100) / 100 : 0;
    const valorPorItem = itensLinha > 0 ? totalValor / itensLinha : 0;
    const coberturaCustoPct =
      itensLinha > 0 ? Math.round((aggAtual.linhasComCusto / itensLinha) * 1000) / 10 : null;

    const opVendAll = new Set(rowsAtualRaw.map((r) => r.vendedor));
    const opGrupoAll = new Set(rowsAtualRaw.map((r) => r.grupoProduto));
    const opStatusAll = new Set(rowsAtualRaw.map((r) => r.status));

    return {
      filtros: { dataIni: filtros.dataIni, dataFim: filtros.dataFim, comparacaoBase },
      kpis: {
        valor: Math.round(totalValor * 100) / 100,
        valorBase: Math.round(aggBase.valor * 100) / 100,
        valorVarPct: pctChange(totalValor, aggBase.valor),
        qtde: Math.round(aggAtual.qtde * 1000) / 1000,
        pedidos,
        clientes: clientesPeriodo.size,
        ticketMedio: Math.round(ticketMedio * 100) / 100,
        ticketMedioCliente: Math.round(ticketMedioCliente * 100) / 100,
        positivacao: clientesPeriodo.size,
        coberturaPct,
        descontoMedioPct,
        itensPorPedido,
        valorPorItem: Math.round(valorPorItem * 100) / 100,
        concentracaoTop20Pct,
        clientesNovos,
        clientesRecorrentes,
        custo: Math.round(aggAtual.custo * 100) / 100,
        margem: Math.round(aggAtual.margem * 100) / 100,
        margemPct: margemPctAgg(aggAtual),
        margemBase: Math.round(aggBase.margem * 100) / 100,
        margemVarPct: pctChange(aggAtual.margem, aggBase.margem),
        coberturaCustoPct,
      },
      serieMensal,
      mixGrupos: rankingFromMap(byGrupo, 25),
      rankingVendedores,
      rankingEquipes: rankingEquipesRaw,
      rankingProdutosMargem,
      mixStatus: rankingFromMap(byStatus, 20).map(({ key, label, valor, qtde, pedidos: p }) => ({
        key,
        label,
        valor,
        qtde,
        pedidos: p,
      })),
      paretoClientes,
      heatmapEquipeMes: [...heat.entries()].map(([k, valor]) => {
        const [equipe, mes] = k.split('|');
        return { equipe: EQUIPE_LABEL[equipe as EquipeComissionamento] ?? equipe, mes, valor: Math.round(valor * 100) / 100 };
      }),
      opcoes: {
        vendedores: [...opVendAll].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        grupos: [...opGrupoAll].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        status: [...opStatusAll].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        equipes: ['televendas', 'vendedores', 'representantes', 'sem_equipe'],
      },
      classificacao: mapa,
    };
  } catch (err) {
    console.error('obterComissionamentoAnalytics', err);
    return { ...empty, erro: err instanceof Error ? err.message : 'Erro ao consultar Nomus.' };
  }
}

export type DrillDimComissionamento = 'mes' | 'grupo' | 'vendedor' | 'equipe' | 'status' | 'cliente';

export async function obterComissionamentoDrill(
  filtros: FiltrosComissionamento,
  dim: DrillDimComissionamento,
  where?: Partial<Pick<ComissionamentoRow, 'mes' | 'grupoProduto' | 'vendedor' | 'equipe' | 'status' | 'cliente'>>
): Promise<Array<{ key: string; label: string; valor: number; qtde: number; pedidos: number }>> {
  const mapa = await obterClassificacaoEquipes();
  if (!isNomusEnabled()) return [];
  let rows = await carregarLinhas(filtros.dataIni, filtros.dataFim, mapa);
  rows = aplicarFiltros(rows, filtros);
  if (where?.mes) rows = rows.filter((r) => r.mes === where.mes);
  if (where?.grupoProduto) rows = rows.filter((r) => matchFiltroCsv(r.grupoProduto, where.grupoProduto));
  if (where?.vendedor) rows = rows.filter((r) => matchFiltroCsv(r.vendedor, where.vendedor));
  if (where?.equipe) rows = rows.filter((r) => matchFiltroCsv(r.equipe, where.equipe));
  if (where?.status) rows = rows.filter((r) => matchFiltroCsv(r.status, where.status));
  if (where?.cliente) rows = rows.filter((r) => matchFiltroCsv(r.cliente, where.cliente));

  const map = new Map<string, AggKey>();
  for (const r of rows) {
    let key = '';
    switch (dim) {
      case 'mes':
        key = r.mes;
        break;
      case 'grupo':
        key = r.grupoProduto;
        break;
      case 'vendedor':
        key = r.vendedor;
        break;
      case 'equipe':
        key = r.equipe;
        break;
      case 'status':
        key = r.status;
        break;
      case 'cliente':
        key = r.cliente;
        break;
      default:
        key = r.vendedor;
    }
    if (!map.has(key)) map.set(key, emptyAgg());
    addAgg(map.get(key)!, r);
  }
  return rankingFromMap(map, 50).map((x) => ({
    ...x,
    label: dim === 'equipe' ? EQUIPE_LABEL[x.key as EquipeComissionamento] ?? x.key : x.label,
  }));
}

export type DetalheComissionamentoWhere = Partial<{
  mes: string;
  grupoProduto: string;
  vendedor: string;
  equipe: EquipeComissionamento | string;
  status: string;
  cliente: string;
  produto: string;
}>;

const DETALHE_LIMIT = 2500;

/** Linhas de venda (item) para análise detalhada nos gráficos. */
export async function listarComissionamentoDetalhe(
  filtros: FiltrosComissionamento,
  where?: DetalheComissionamentoWhere
): Promise<{ rows: ComissionamentoRow[]; truncado: boolean; erro?: string }> {
  const errPeriodo = validarPeriodoComissionamento(filtros.dataIni, filtros.dataFim);
  if (errPeriodo) return { rows: [], truncado: false, erro: errPeriodo };
  if (!isNomusEnabled()) return { rows: [], truncado: false, erro: 'Nomus não configurado.' };

  try {
    const mapa = await obterClassificacaoEquipes();
    let rows = await carregarLinhasComCusto(filtros.dataIni, filtros.dataFim, mapa);
    rows = aplicarFiltros(rows, filtros);
    if (where?.mes) rows = rows.filter((r) => r.mes === where.mes);
    if (where?.grupoProduto) rows = rows.filter((r) => matchFiltroCsv(r.grupoProduto, where.grupoProduto));
    if (where?.vendedor) rows = rows.filter((r) => matchFiltroCsv(r.vendedor, where.vendedor));
    if (where?.equipe) rows = rows.filter((r) => matchFiltroCsv(r.equipe, where.equipe));
    if (where?.status) rows = rows.filter((r) => matchFiltroCsv(r.status, where.status));
    if (where?.cliente) rows = rows.filter((r) => matchFiltroCsv(r.cliente, where.cliente));
    if (where?.produto) {
      rows = rows.filter((r) => {
        const parts = parseFiltroCsv(where.produto);
        return parts.length === 0 || parts.some((p) => r.codigoProduto === p || r.descricaoProduto === p);
      });
    }
    rows.sort((a, b) => {
      const d = b.dataEmissao.localeCompare(a.dataEmissao);
      if (d !== 0) return d;
      return b.valorVendido - a.valorVendido;
    });
    const truncado = rows.length > DETALHE_LIMIT;
    return { rows: truncado ? rows.slice(0, DETALHE_LIMIT) : rows, truncado };
  } catch (err) {
    console.error('listarComissionamentoDetalhe', err);
    return {
      rows: [],
      truncado: false,
      erro: err instanceof Error ? err.message : 'Erro ao consultar detalhe.',
    };
  }
}

export type ComparativoVendedorItem = {
  vendedor: string;
  equipe: EquipeComissionamento;
  valor: number;
  qtde: number;
  pedidos: number;
  clientes: number;
  ticketMedio: number;
  custo: number;
  margem: number;
  margemPct: number | null;
  serieMensal: Array<{ mes: string; valor: number; qtde: number; pedidos: number; margem?: number }>;
};

/** Compara vendedores selecionados (série mensal + KPIs) dentro do filtro do painel. */
export async function obterComissionamentoComparativo(
  filtros: FiltrosComissionamento,
  vendedores: string[]
): Promise<{ items: ComparativoVendedorItem[]; meses: string[]; erro?: string }> {
  const nomes = [...new Set(vendedores.map((v) => v.trim()).filter(Boolean))].slice(0, 8);
  if (nomes.length < 2) {
    return { items: [], meses: [], erro: 'Selecione ao menos 2 vendedores para comparar.' };
  }
  const errPeriodo = validarPeriodoComissionamento(filtros.dataIni, filtros.dataFim);
  if (errPeriodo) return { items: [], meses: [], erro: errPeriodo };
  if (!isNomusEnabled()) return { items: [], meses: [], erro: 'Nomus não configurado.' };

  try {
    const mapa = await obterClassificacaoEquipes();
    let rows = await carregarLinhasComCusto(filtros.dataIni, filtros.dataFim, mapa);
    rows = aplicarFiltros(rows, filtros);
    rows = rows.filter((r) => nomes.includes(r.vendedor));

    const mesesSet = new Set<string>();
    const byVendMes = new Map<string, Map<string, AggKey>>();
    const byVend = new Map<string, AggKey>();

    for (const nome of nomes) {
      byVend.set(nome, emptyAgg());
      byVendMes.set(nome, new Map());
    }

    for (const r of rows) {
      if (!byVend.has(r.vendedor)) continue;
      addAgg(byVend.get(r.vendedor)!, r);
      const mm = byVendMes.get(r.vendedor)!;
      if (!mm.has(r.mes)) mm.set(r.mes, emptyAgg());
      addAgg(mm.get(r.mes)!, r);
      mesesSet.add(r.mes);
    }

    const meses = [...mesesSet].sort();
    const items: ComparativoVendedorItem[] = nomes.map((vendedor) => {
      const a = byVend.get(vendedor)!;
      const mm = byVendMes.get(vendedor)!;
      return {
        vendedor,
        equipe: resolverEquipe(vendedor, mapa),
        valor: Math.round(a.valor * 100) / 100,
        qtde: Math.round(a.qtde * 1000) / 1000,
        pedidos: a.pedidos.size,
        clientes: a.clientes.size,
        ticketMedio: a.pedidos.size > 0 ? Math.round((a.valor / a.pedidos.size) * 100) / 100 : 0,
        custo: Math.round(a.custo * 100) / 100,
        margem: Math.round(a.margem * 100) / 100,
        margemPct: margemPctAgg(a),
        serieMensal: meses.map((mes) => {
          const cell = mm.get(mes);
          return {
            mes,
            valor: Math.round((cell?.valor ?? 0) * 100) / 100,
            qtde: Math.round((cell?.qtde ?? 0) * 1000) / 1000,
            pedidos: cell?.pedidos.size ?? 0,
            margem: Math.round((cell?.margem ?? 0) * 100) / 100,
          };
        }),
      };
    });

    items.sort((a, b) => b.valor - a.valor);
    return { items, meses };
  } catch (err) {
    console.error('obterComissionamentoComparativo', err);
    return {
      items: [],
      meses: [],
      erro: err instanceof Error ? err.message : 'Erro ao comparar vendedores.',
    };
  }
}

/** Janela fixa da análise de inativos (pedido do negócio). */
export const CLIENTES_INATIVOS_DATA_INI = '2025-01-01';
export const CLIENTES_INATIVOS_DIAS = 90;
const CONFIG_WHATSAPP_INATIVOS = 'comissionamento_inativos_whatsapp_v1';

export type ClienteInativoComissionamento = {
  cliente: string;
  ultimaCompra: string;
  diasSemCompra: number;
  vendedorUltimo: string;
  equipe: EquipeComissionamento;
  pedidos: number;
  valor: number;
};

function hojeYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diasEntreYmd(ini: string, fim: string): number {
  const a = new Date(`${ini}T12:00:00`);
  const b = new Date(`${fim}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Clientes com última compra há mais de 90 dias, analisando pedidos desde 01/01/2025.
 * Respeita filtros dimensionais do painel (equipe, vendedor, grupo, status).
 */
export async function listarClientesInativosComissionamento(
  filtros: FiltrosComissionamento
): Promise<{
  referencia: string;
  dataIniAnalise: string;
  dataFimAnalise: string;
  diasSemCompraMin: number;
  clientes: ClienteInativoComissionamento[];
  total: number;
  erro?: string;
}> {
  const referencia = hojeYmdLocal();
  const dataIniAnalise = CLIENTES_INATIVOS_DATA_INI;
  const dataFimAnalise =
    clampYmd(filtros.dataFim) && filtros.dataFim > referencia ? filtros.dataFim : referencia;
  const base = {
    referencia,
    dataIniAnalise,
    dataFimAnalise,
    diasSemCompraMin: CLIENTES_INATIVOS_DIAS,
    clientes: [] as ClienteInativoComissionamento[],
    total: 0,
  };

  if (!isNomusEnabled()) return { ...base, erro: 'Nomus não configurado.' };

  try {
    const mapa = await obterClassificacaoEquipes();
    const raw = await carregarLinhas(dataIniAnalise, dataFimAnalise, mapa);
    const rows = aplicarFiltros(raw, {
      ...filtros,
      dataIni: dataIniAnalise,
      dataFim: dataFimAnalise,
    });

    type Acc = {
      ultimaCompra: string;
      vendedorUltimo: string;
      equipe: EquipeComissionamento;
      pedidos: Set<number>;
      valor: number;
    };
    const byCliente = new Map<string, Acc>();

    for (const r of rows) {
      if (!r.cliente || r.cliente === '—') continue;
      let acc = byCliente.get(r.cliente);
      if (!acc) {
        acc = {
          ultimaCompra: r.dataEmissao,
          vendedorUltimo: r.vendedor,
          equipe: r.equipe,
          pedidos: new Set([r.pdId]),
          valor: r.valorVendido,
        };
        byCliente.set(r.cliente, acc);
        continue;
      }
      acc.pedidos.add(r.pdId);
      acc.valor += r.valorVendido;
      if (r.dataEmissao >= acc.ultimaCompra) {
        acc.ultimaCompra = r.dataEmissao;
        acc.vendedorUltimo = r.vendedor;
        acc.equipe = r.equipe;
      }
    }

    const clientes: ClienteInativoComissionamento[] = [];
    for (const [cliente, acc] of byCliente) {
      const dias = diasEntreYmd(acc.ultimaCompra, referencia);
      if (dias < CLIENTES_INATIVOS_DIAS) continue;
      clientes.push({
        cliente,
        ultimaCompra: acc.ultimaCompra,
        diasSemCompra: dias,
        vendedorUltimo: acc.vendedorUltimo,
        equipe: acc.equipe,
        pedidos: acc.pedidos.size,
        valor: Math.round(acc.valor * 100) / 100,
      });
    }

    clientes.sort((a, b) => b.diasSemCompra - a.diasSemCompra || b.valor - a.valor);
    return { ...base, clientes, total: clientes.length };
  } catch (err) {
    console.error('listarClientesInativosComissionamento', err);
    return {
      ...base,
      erro: err instanceof Error ? err.message : 'Erro ao listar clientes inativos.',
    };
  }
}

export function montarMensagemClientesInativos(
  clientes: ClienteInativoComissionamento[],
  meta: { referencia: string; dataIniAnalise: string; diasSemCompraMin: number }
): string {
  const top = clientes.slice(0, 40);
  const linhas = top.map(
    (c, i) =>
      `${i + 1}. ${c.cliente} — ${c.diasSemCompra}d (últ. ${c.ultimaCompra.slice(0, 10)}) · ${c.vendedorUltimo} · R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  );
  const extras =
    clientes.length > top.length ? `\n… +${clientes.length - top.length} cliente(s)` : '';
  return [
    `*Clientes sem compra há +${meta.diasSemCompraMin} dias*`,
    `Análise: ${meta.dataIniAnalise} → ${meta.referencia}`,
    `Total: ${clientes.length}`,
    '',
    ...linhas,
    extras,
  ]
    .filter((x) => x !== '')
    .join('\n');
}

export async function obterWhatsappDestinoInativos(): Promise<string> {
  const fromEnv = String(process.env.COMISSIONAMENTO_INATIVOS_WHATSAPP ?? '').trim();
  const row = await prisma.config.findUnique({ where: { key: CONFIG_WHATSAPP_INATIVOS } });
  const fromDb = String(row?.value ?? '').trim();
  return fromDb || fromEnv;
}

export async function salvarWhatsappDestinoInativos(numero: string): Promise<string> {
  const value = String(numero ?? '').trim();
  await prisma.config.upsert({
    where: { key: CONFIG_WHATSAPP_INATIVOS },
    create: { key: CONFIG_WHATSAPP_INATIVOS, value },
    update: { value },
  });
  return value;
}

