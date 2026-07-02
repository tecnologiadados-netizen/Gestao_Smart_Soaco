/**
 * DFC — agregação a partir do SQL Server Shop9 (Financeiro_Contas).
 * Retrospectivo: dataBaixa + valorBaixado. Projeção: dataVencimento + saldoBaixar.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import type {
  DfcAgendamentoDetalheRow,
  DfcAgendamentoGranularidade,
  DfcAgendamentoLinha,
} from './dfcAgendamentoRepository.js';
import {
  filtrarPorEmpresasSelecionadas,
  labelEmpresaDfc,
  resolverNomusIdEmpresaShop9,
  normalizarIdsEmpresasDfc,
} from './dfcShop9Empresa.js';
import {
  DFC_ID_RECEITA_VENDAS_PRODUTO,
  resolverIdContaFinanceiroShop9,
  shop9CodigoEhReceitaVendasProduto,
} from './dfcShop9PlanoContasMap.js';
import { formatSqlDateYmd as formatYmd } from './dfcDateUtils.js';
import type { DfcContribuicaoLinha } from './dfcContribuicaoRepository.js';

export { formatYmd };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FINANCEIRO = readFileSync(join(__dirname, 'sql', 'dfcShop9Financeiro.sql'), 'utf-8');
const DATA_EMISSAO_MIN = '2024-01-01';
const DATA_RELACAO_MIN = '2023-01-01';
const CACHE_MS = 90_000;
/** Bump ao alterar SQL/colunas ou regras de filtro empresa. */
const CACHE_VERSION = 11;

function hojeYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Linha em aberto (projeção): sem data de baixa. */
function shop9LinhaEmAberto(r: Shop9FinanceiroRow): boolean {
  return formatYmd(r.dataBaixa) == null;
}

/** Cabeçalho agregador no Shop9 — não é baixa efetiva (evita duplicar o filho no modal/grade). */
function shop9LinhaEhContaPai(r: Shop9FinanceiroRow): boolean {
  return /conta\s*pai/i.test(String(r.descricaoLancamento ?? ''));
}

function shop9LinhaUsavel(r: Shop9FinanceiroRow): boolean {
  return !shop9LinhaEhContaPai(r);
}

/** Receitas de vendas: SQL já normaliza id 2; aceita também códigos Shop9 originais. */
function shop9LinhaEhReceitaVendas(r: Pick<Shop9FinanceiroRow, 'tipoConta' | 'idPlanoContas'>): boolean {
  if (r.tipoConta.trim().toUpperCase() !== 'R') return false;
  return (
    r.idPlanoContas === DFC_ID_RECEITA_VENDAS_PRODUTO ||
    shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)
  );
}

/** id na árvore DFC — somente pelo nome do plano (Plano_Contas3.Nome). */
function resolverIdContaShop9(
  r: Pick<Shop9FinanceiroRow, 'tipoConta' | 'idPlanoContas' | 'planoContas'>,
): number | null {
  return resolverIdContaFinanceiroShop9(r.tipoConta, r.idPlanoContas, r.planoContas);
}

export type Shop9FinanceiroRow = {
  /** Chave única da linha em Financeiro_Contas (deduplicação). */
  ordemFinanceira: number;
  ordemFilial: number;
  nomeFilial: string | null;
  centrocusto: string | null;
  codigoConta: number;
  tipoConta: string;
  dataBaixa: Date | string | null;
  dataVencimento: Date | string | null;
  descricaoLancamento: string | null;
  idPlanoContas: number | null;
  planoContas: string | null;
  valorBaixado: number;
  saldoBaixar: number;
  empresa: string | null;
  nomeRazaoSocial: string | null;
  clienteFornecedor: string | null;
};

let rowsCache: { at: number; v: number; rows: Shop9FinanceiroRow[] } | null = null;

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function periodoFromYmd(ymd: string, granularidade: DfcAgendamentoGranularidade): string {
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

function deduplicarDetalheShop9(rows: DfcAgendamentoDetalheRow[]): DfcAgendamentoDetalheRow[] {
  const byId = new Map<number, DfcAgendamentoDetalheRow>();
  for (const d of rows) {
    if (d.id > 0 && !byId.has(d.id)) byId.set(d.id, d);
  }
  return [...byId.values()];
}

/** Uma linha por fc.Ordem (evita fan-out residual entre UNIONs). */
function deduplicarLinhasShop9(rows: Shop9FinanceiroRow[]): Shop9FinanceiroRow[] {
  const byOrdem = new Map<number, Shop9FinanceiroRow>();
  for (const r of rows) {
    const key = r.ordemFinanceira > 0 ? r.ordemFinanceira : r.codigoConta;
    if (key > 0 && !byOrdem.has(key)) byOrdem.set(key, r);
  }
  return [...byOrdem.values()];
}

function mapRawRow(r: Record<string, unknown>): Shop9FinanceiroRow {
  const ordemFinanceira = toInt(r.ordemFinanceira ?? r['ordemFinanceira']);
  return {
    ordemFinanceira: ordemFinanceira > 0 ? ordemFinanceira : toInt(r.codigoConta ?? r['codigoConta']),
    ordemFilial: toInt(r.idEmpresa ?? r['idEmpresa'] ?? r.ordemFilial ?? r['ordemFilial']),
    nomeFilial: r.nomeFilial != null ? String(r.nomeFilial) : null,
    centrocusto: r.centrocusto != null ? String(r.centrocusto) : null,
    codigoConta: toInt(r.codigoConta ?? r['codigoConta']),
    tipoConta: String(r.tipoConta ?? r['tipoConta'] ?? '').trim(),
    dataBaixa: (r.dataBaixa ?? r['dataBaixa']) as Date | string | null,
    dataVencimento: (r.dataVencimento ?? r['dataVencimento']) as Date | string | null,
    descricaoLancamento: r.descricaoLancamento != null ? String(r.descricaoLancamento) : null,
    idPlanoContas: r.idPlanoContas != null ? toInt(r.idPlanoContas) : null,
    planoContas: r.planoContas != null ? String(r.planoContas) : null,
    valorBaixado: toNum(r.valorBaixado ?? r['valorBaixado']),
    saldoBaixar: toNum(r.saldoBaixar ?? r['saldoBaixar']),
    empresa: r.empresa != null ? String(r.empresa) : null,
    nomeRazaoSocial: r.nomeRazaoSocial != null ? String(r.nomeRazaoSocial) : null,
    clienteFornecedor: r.clienteFornecedor != null ? String(r.clienteFornecedor) : null,
  };
}

export async function carregarLinhasShop9Financeiro(force = false): Promise<{
  rows: Shop9FinanceiroRow[];
  erro?: string;
}> {
  if (!isShop9Enabled()) {
    return { rows: [], erro: 'Shop9: SHOP9_DB_* não configurado' };
  }
  if (
    !force &&
    rowsCache &&
    rowsCache.v === CACHE_VERSION &&
    Date.now() - rowsCache.at < CACHE_MS
  ) {
    return { rows: rowsCache.rows };
  }

  const pool = await getShop9Pool();
  if (!pool) return { rows: [], erro: 'Shop9: falha ao conectar' };

  try {
    const req = pool.request();
    req.input('dataEmissaoMin', sql.Date, new Date(DATA_EMISSAO_MIN));
    req.input('dataRelacaoMin', sql.Date, new Date(DATA_RELACAO_MIN));
    const result = await req.query(SQL_FINANCEIRO);
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    const rows = deduplicarLinhasShop9(
      list.map((r) => mapRawRow(r as Record<string, unknown>))
    );
    rowsCache = { at: Date.now(), v: CACHE_VERSION, rows };
    return { rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcShop9Repository] carregarLinhasShop9Financeiro:', msg);
    return { rows: [], erro: msg };
  }
}

export function invalidarCacheShop9(): void {
  rowsCache = null;
}

function agregarLinhas(
  map: Map<string, number>,
  idConta: number,
  periodo: string,
  valor: number,
): void {
  if (!idConta || !periodo || !Number.isFinite(valor) || valor === 0) return;
  const key = `${idConta}\t${periodo}`;
  map.set(key, (map.get(key) ?? 0) + valor);
}

function mapParaLinhas(
  map: Map<string, number>,
  granularidade: DfcAgendamentoGranularidade,
): DfcAgendamentoLinha[] {
  const linhas: DfcAgendamentoLinha[] = [];
  for (const [key, valor] of map) {
    const [idStr, periodo] = key.split('\t');
    linhas.push({
      idContaFinanceiro: Number(idStr),
      periodo: granularidade === 'mes' ? periodo.slice(0, 7) : periodo,
      valor,
    });
  }
  linhas.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.idContaFinanceiro - b.idContaFinanceiro);
  return linhas;
}

/** Realizados Shop9 (todas as contas) — dataBaixa <= hoje. */
export async function queryDfcShop9RetroAgregado(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const { dataBaixaInicio, dataBaixaFim, granularidade, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const ids = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, ids);
  const map = new Map<string, number>();
  const hoje = hojeYmdLocal();

  for (const r of rows) {
    if (!shop9LinhaUsavel(r)) continue;
    if (shop9LinhaEmAberto(r)) continue;
    const ymd = formatYmd(r.dataBaixa);
    if (!ymd || ymd < dataBaixaInicio || ymd > dataBaixaFim) continue;
    if (ymd > hoje) continue;
    const idConta = resolverIdContaShop9(r);
    if (idConta == null) continue;
    const periodo = periodoFromYmd(ymd, granularidade);
    const valor = r.valorBaixado;
    if (valor === 0) continue;
    agregarLinhas(map, idConta, periodo, valor);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

/** Receitas de vendas (R) — valorBaixado na dataBaixa. */
export async function queryDfcShop9RetroReceitasVendas(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const { dataBaixaInicio, dataBaixaFim, granularidade, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const ids = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, ids);
  const map = new Map<string, number>();

  for (const r of rows) {
    if (!shop9LinhaUsavel(r)) continue;
    if (!shop9LinhaEhReceitaVendas(r)) continue;
    if (shop9LinhaEmAberto(r)) continue;
    const ymd = formatYmd(r.dataBaixa);
    if (!ymd || ymd < dataBaixaInicio || ymd > dataBaixaFim) continue;
    const idConta = resolverIdContaShop9(r) ?? DFC_ID_RECEITA_VENDAS_PRODUTO;
    const periodo = periodoFromYmd(ymd, granularidade);
    const valor = r.valorBaixado;
    if (valor === 0) continue;
    agregarLinhas(map, idConta, periodo, valor);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

/** Projeção Shop9 (todas as contas) — dataVencimento > hoje para linhas em aberto. */
export async function queryDfcShop9ProjecaoAgregado(params: {
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const { dataVencimentoInicio, dataVencimentoFim, granularidade, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const ids = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, ids);
  const map = new Map<string, number>();

  const hoje = hojeYmdLocal();

  for (const r of rows) {
    if (!shop9LinhaUsavel(r)) continue;
    if (!shop9LinhaEmAberto(r)) continue;
    const ymd = formatYmd(r.dataVencimento);
    if (!ymd || ymd <= hoje) continue;
    if (ymd < dataVencimentoInicio || ymd > dataVencimentoFim) continue;
    const saldo = r.saldoBaixar;
    if (saldo <= 0) continue;
    const idConta = resolverIdContaShop9(r);
    if (idConta == null) continue;
    const periodo = periodoFromYmd(ymd, granularidade);
    agregarLinhas(map, idConta, periodo, saldo);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

/** Receitas de vendas (R) em aberto — saldoBaixar por dataVencimento. */
export async function queryDfcShop9ProjecaoReceitasVendas(params: {
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const { dataVencimentoInicio, dataVencimentoFim, granularidade, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const ids = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, ids);
  const map = new Map<string, number>();
  const hoje = hojeYmdLocal();

  for (const r of rows) {
    if (!shop9LinhaUsavel(r)) continue;
    if (!shop9LinhaEhReceitaVendas(r)) continue;
    if (!shop9LinhaEmAberto(r)) continue;
    const ymd = formatYmd(r.dataVencimento);
    if (!ymd || ymd <= hoje) continue;
    if (ymd < dataVencimentoInicio || ymd > dataVencimentoFim) continue;
    const saldo = r.saldoBaixar;
    if (saldo <= 0) continue;
    const idConta = resolverIdContaShop9(r) ?? DFC_ID_RECEITA_VENDAS_PRODUTO;
    const periodo = periodoFromYmd(ymd, granularidade);
    agregarLinhas(map, idConta, periodo, saldo);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

/** Retro + projeção Shop9 em uma chamada (menos round-trips no controller). */
export async function queryDfcShop9AgregadoCompleto(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
}): Promise<{ linhasRetro: DfcAgendamentoLinha[]; linhasProj: DfcAgendamentoLinha[]; erro?: string }> {
  const [retro, proj] = await Promise.all([
    queryDfcShop9RetroAgregado({
      dataBaixaInicio: params.dataBaixaInicio,
      dataBaixaFim: params.dataBaixaFim,
      granularidade: params.granularidade,
      idEmpresas: params.idEmpresas,
    }),
    queryDfcShop9ProjecaoAgregado({
      dataVencimentoInicio: params.dataVencimentoInicio,
      dataVencimentoFim: params.dataVencimentoFim,
      granularidade: params.granularidade,
      idEmpresas: params.idEmpresas,
    }),
  ]);
  const erro = retro.erro && retro.linhas.length === 0 ? retro.erro : proj.erro;
  return { linhasRetro: retro.linhas, linhasProj: proj.linhas, erro };
}

function empresaParaIdNomus(row: Shop9FinanceiroRow): number {
  return resolverNomusIdEmpresaShop9(row) ?? (row.ordemFilial === 6 ? 2 : 1);
}

function empresaDetalheShop9(row: Shop9FinanceiroRow): string | null {
  const nome = row.empresa?.trim();
  if (nome) return nome;
  const id = empresaParaIdNomus(row);
  return labelEmpresaDfc(id);
}

export async function queryDfcShop9Detalhe(params: {
  modo: 'retro' | 'proj';
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  idsContaFinanceiro: number[];
  periodoBucket?: string | null;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  const {
    modo,
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    idsContaFinanceiro,
    periodoBucket,
  } = params;
  const idsSet = new Set(idsContaFinanceiro.filter((n) => n > 0));
  if (idsSet.size === 0) return { detalhes: [] };

  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { detalhes: [], erro };

  const idsEmp = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, idsEmp);
  const hoje = hojeYmdLocal();
  const detalhes: DfcAgendamentoDetalheRow[] = [];

  for (const r of rows) {
    if (!shop9LinhaUsavel(r)) continue;
    const idConta = resolverIdContaShop9(r);
    if (idConta == null || !idsSet.has(idConta)) continue;

    if (modo === 'retro') {
      if (shop9LinhaEmAberto(r)) continue;
      const dataBaixa = formatYmd(r.dataBaixa);
      if (!dataBaixa || dataBaixa < dataInicio || dataBaixa > dataFim) continue;
      if (dataBaixa > hoje) continue;
      const periodo = periodoFromYmd(dataBaixa, granularidade);
      if (periodoBucket && periodo !== periodoBucket) continue;
      detalhes.push({
        id: r.ordemFinanceira,
        descricaoLancamento: r.descricaoLancamento,
        nome: r.nomeRazaoSocial ?? r.clienteFornecedor,
        dataVencimento: formatYmd(r.dataVencimento),
        dataBaixa,
        valorBaixado: r.valorBaixado,
        tipoRef: 'A',
        idEmpresa: empresaParaIdNomus(r),
        idContaFinanceiro: idConta,
        empresa: empresaDetalheShop9(r),
      });
      continue;
    }

    if (!shop9LinhaEmAberto(r)) continue;
    const dataVenc = formatYmd(r.dataVencimento);
    if (!dataVenc || dataVenc <= hoje) continue;
    if (dataVenc < dataInicio || dataVenc > dataFim) continue;
    const periodo = periodoFromYmd(dataVenc, granularidade);
    if (periodoBucket && periodo !== periodoBucket) continue;
    if (r.saldoBaixar <= 0) continue;

    detalhes.push({
      id: r.ordemFinanceira,
      descricaoLancamento: r.descricaoLancamento,
      nome: r.nomeRazaoSocial ?? r.clienteFornecedor,
      dataVencimento: dataVenc,
      dataBaixa: null,
      valorBaixado: r.saldoBaixar,
      tipoRef: 'A',
      idEmpresa: empresaParaIdNomus(r),
      idContaFinanceiro: idConta,
      empresa: empresaDetalheShop9(r),
    });
  }

  const detalhesUnicos = deduplicarDetalheShop9(detalhes);
  detalhesUnicos.sort((a, b) => b.valorBaixado - a.valorBaixado);
  return { detalhes: detalhesUnicos.slice(0, 2000), erro };
}

function pushContribuicaoShop9(
  out: DfcContribuicaoLinha[],
  r: Shop9FinanceiroRow,
  idConta: number,
  dataBucket: string,
  valor: number,
): void {
  if (!idConta || !dataBucket || !Number.isFinite(valor) || valor === 0) return;
  out.push({
    idContaFinanceiro: idConta,
    valor,
    idEmpresa: empresaParaIdNomus(r),
    empresa: r.empresa?.trim() || r.nomeFilial?.trim() || null,
    contaBancaria: null,
    codigoConta: r.ordemFinanceira,
    tipoRef: 'L',
    dataBucket,
  });
}

export async function coletarContribuicoesShop9(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
}): Promise<{ contribuicoes: DfcContribuicaoLinha[]; erro?: string }> {
  const { dataInicio, dataFim, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasShop9Financeiro();
  if (erro && raw.length === 0) return { contribuicoes: [], erro };

  const ids = normalizarIdsEmpresasDfc(idEmpresas);
  const rows = filtrarPorEmpresasSelecionadas(raw, ids);
  const contribuicoes: DfcContribuicaoLinha[] = [];
  const hoje = hojeYmdLocal();
  const retroFim = dataFim < hoje ? dataFim : hoje;
  const amanha = amanhaYmdLocal();
  const projInicio = dataInicio >= amanha ? dataInicio : amanha;

  if (dataInicio <= retroFim) {
    for (const r of rows) {
      if (!shop9LinhaUsavel(r)) continue;
      if (shop9LinhaEmAberto(r)) continue;
      const ymd = formatYmd(r.dataBaixa);
      if (!ymd || ymd < dataInicio || ymd > retroFim) continue;
      const idConta = resolverIdContaShop9(r);
      if (idConta == null) continue;
      pushContribuicaoShop9(contribuicoes, r, idConta, ymd, r.valorBaixado);
    }
  }

  if (projInicio <= dataFim) {
    for (const r of rows) {
      if (!shop9LinhaUsavel(r)) continue;
      if (!shop9LinhaEmAberto(r)) continue;
      const ymd = formatYmd(r.dataVencimento);
      if (!ymd || ymd <= hoje) continue;
      if (ymd < projInicio || ymd > dataFim) continue;
      const saldo = r.saldoBaixar;
      if (saldo <= 0) continue;
      const idConta = resolverIdContaShop9(r);
      if (idConta == null) continue;
      pushContribuicaoShop9(contribuicoes, r, idConta, ymd, saldo);
    }
  }

  return { contribuicoes, erro };
}

function amanhaYmdLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function testarConexaoShop9(): Promise<{ ok: boolean; linhas?: number; erro?: string }> {
  const { rows, erro } = await carregarLinhasShop9Financeiro(true);
  if (erro && rows.length === 0) return { ok: false, erro };
  return { ok: true, linhas: rows.length, erro };
}
