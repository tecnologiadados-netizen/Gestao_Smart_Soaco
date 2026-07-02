/**
 * DFC — base unificada Nomus (sql/dfcNomusFinanceiro.sql).
 * Carrega linhas em cache e agrega retrospectivo / projeção por discriminador.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool } from '../config/nomusDb.js';
import type {
  DfcAgendamentoDetalheRow,
  DfcAgendamentoGranularidade,
  DfcAgendamentoLinha,
} from './dfcAgendamentoRepository.js';
import {
  linhaPassaFiltroPrioridade,
  type DfcPrioridadeFilterResolvido,
} from './dfcPrioridadeFilter.js';
import type { DfcTipoRefLancamento } from './dfcPrioridadeConstantes.js';
import { filtrarPorEmpresasSelecionadas, labelEmpresaDfc, resolverIdEmpresaDfc } from './dfcShop9Empresa.js';
import { resolverIdContaFinanceiroDfc } from './dfcShop9PlanoContasMap.js';
import { formatSqlDateYmd as formatYmd } from './dfcDateUtils.js';
import type { DfcContribuicaoLinha } from './dfcContribuicaoRepository.js';

export { formatYmd };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_TEMPLATE = readFileSync(join(__dirname, 'sql', 'dfcNomusFinanceiro.sql'), 'utf-8');

/** Ramo 1: agendamento com vencimento mínimo. Ramo 2: lançamentos (filtros no SQL de negócio). */
const DATA_VENCIMENTO_MIN = '2024-12-01';
const DATA_LANCAMENTO_MIN = '2024-01-01';
const CACHE_MS = 90_000;
const CACHE_VERSION = 18;
export const DFC_EMPRESAS_CARGA = [1, 2, 3, 4];

export type NomusDiscriminadorDfc = 'P' | 'R' | 'LR' | 'LP';

export type NomusFinanceiroRow = {
  idContaBancaria: number | null;
  contaBancaria: string | null;
  codigoConta: number;
  tipoConta: string;
  dataBaixa: Date | string | null;
  dataAgendamento: Date | string | null;
  dataVencimento: Date | string | null;
  dataCompetencia: Date | string | null;
  descricaoLancamento: string | null;
  idPlanoContas: number | null;
  planoContas: string | null;
  valorBaixar: number;
  valorBaixado: number;
  saldoBaixar: number;
  idEmpresa: number;
  empresa: string | null;
  idPessoa: number | null;
  nomeRazaoSocial: string | null;
  clienteFornecedor: string | null;
  tipoRef: DfcTipoRefLancamento;
};

let rowsCache: { at: number; v: number; rows: NomusFinanceiroRow[] } | null = null;

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function hojeYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function amanhaYmdLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

function periodoFromYmd(ymd: string, granularidade: DfcAgendamentoGranularidade): string {
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

function substituirPlaceholdersSql(sql: string): string {
  return sql
    .replace(/\{\{EMP_IN\}\}/g, DFC_EMPRESAS_CARGA.join(', '))
    .replace(/\{\{DATA_VENCIMENTO_MIN\}\}/g, DATA_VENCIMENTO_MIN)
    .replace(/\{\{DATA_LANCAMENTO_MIN\}\}/g, DATA_LANCAMENTO_MIN);
}

/** Divide o script nos 2 SELECTs (CRLF e linhas em branco ao redor do UNION ALL quebravam o split antigo). */
function sqlBlocosCarga(): string[] {
  const sql = substituirPlaceholdersSql(SQL_TEMPLATE);
  const parts = sql
    .split(/\r?\n\s*UNION\s+ALL\s*\r?\n/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts;
}

function mapRawRow(r: Record<string, unknown>, tipoRefBloco: DfcTipoRefLancamento): NomusFinanceiroRow {
  const tipoRefRaw = String(r.tipoRef ?? r['tipoRef'] ?? tipoRefBloco).trim().toUpperCase();
  const tipoRef: DfcTipoRefLancamento = tipoRefRaw === 'L' ? 'L' : 'A';
  const contaBancariaRaw = r.contaBancaria ?? r['contaBancaria'] ?? r.nome ?? r['nome'];
  return {
    idContaBancaria: r.idContaBancaria != null ? toInt(r.idContaBancaria) : null,
    contaBancaria: contaBancariaRaw != null ? String(contaBancariaRaw).trim() || null : null,
    codigoConta: toInt(r.codigoConta ?? r['codigoConta']),
    tipoConta: String(r.tipoConta ?? r['tipoConta'] ?? '').trim(),
    dataBaixa: (r.dataBaixa ?? r['dataBaixa']) as Date | string | null,
    dataAgendamento: (r.dataAgendamento ?? r['dataAgendamento']) as Date | string | null,
    dataVencimento: (r.dataVencimento ?? r['dataVencimento']) as Date | string | null,
    dataCompetencia: (r.dataCompetencia ?? r['dataCompetencia']) as Date | string | null,
    descricaoLancamento: r.descricaoLancamento != null ? String(r.descricaoLancamento) : null,
    idPlanoContas: r.idPlanoContas != null ? toInt(r.idPlanoContas) : null,
    planoContas: r.planoContas != null ? String(r.planoContas) : null,
    valorBaixar: toNum(r.valorBaixar ?? r['valorBaixar']),
    valorBaixado: toNum(r.valorBaixado ?? r['valorBaixado']),
    saldoBaixar: toNum(r.saldoBaixar ?? r['saldoBaixar']),
    idEmpresa: toInt(r.idEmpresa ?? r['idEmpresa']),
    empresa: r.empresa != null ? String(r.empresa) : null,
    idPessoa: r.idPessoa != null ? toInt(r.idPessoa) : null,
    nomeRazaoSocial: r.nomeRazaoSocial != null ? String(r.nomeRazaoSocial) : null,
    clienteFornecedor: r.clienteFornecedor != null ? String(r.clienteFornecedor) : null,
    tipoRef,
  };
}

export async function carregarLinhasNomusFinanceiro(force = false): Promise<{
  rows: NomusFinanceiroRow[];
  erro?: string;
}> {
  if (
    !force &&
    rowsCache &&
    rowsCache.v === CACHE_VERSION &&
    Date.now() - rowsCache.at < CACHE_MS
  ) {
    return { rows: rowsCache.rows };
  }

  const pool = getNomusPool();
  if (!pool) return { rows: [], erro: 'NOMUS_DB_URL não configurado' };

  const blocos = sqlBlocosCarga();
  try {
    if (blocos.length !== 2) {
      console.error('[dfcNomusRepository] Esperados 2 blocos UNION ALL, obtidos:', blocos.length);
    }
    const brutas: NomusFinanceiroRow[] = [];
    const errosBloco: string[] = [];
    for (let i = 0; i < blocos.length; i++) {
      const tipoRefBloco: DfcTipoRefLancamento = i === 0 ? 'A' : 'L';
      try {
        const [result] = await pool.query(blocos[i]);
        const list = Array.isArray(result) ? result : [];
        for (const r of list) brutas.push(mapRawRow(r as Record<string, unknown>, tipoRefBloco));
      } catch (errBloco) {
        const msgBloco = errBloco instanceof Error ? errBloco.message : String(errBloco);
        errosBloco.push(`bloco ${i + 1}: ${msgBloco}`);
        console.error(`[dfcNomusRepository] carregar bloco ${i + 1}:`, msgBloco);
      }
    }
    if (brutas.length === 0 && errosBloco.length > 0) {
      return { rows: [], erro: errosBloco.join('; ') };
    }
    rowsCache = { at: Date.now(), v: CACHE_VERSION, rows: brutas };
    return { rows: brutas, erro: errosBloco.length > 0 ? errosBloco.join('; ') : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcNomusRepository] carregarLinhasNomusFinanceiro:', msg);
    return { rows: [], erro: msg };
  }
}

export function invalidarCacheNomus(): void {
  rowsCache = null;
}

/** Força recarga na próxima consulta (após alterar SQL). */
export function invalidarCacheNomusAoIniciar(): void {
  invalidarCacheNomus();
}
invalidarCacheNomusAoIniciar();

function filtrarEmpresas(rows: NomusFinanceiroRow[], idEmpresas: number[]): NomusFinanceiroRow[] {
  return filtrarPorEmpresasSelecionadas(rows, idEmpresas);
}

function filtrarContasBancarias(rows: NomusFinanceiroRow[], contasBancarias?: string[]): NomusFinanceiroRow[] {
  if (!contasBancarias?.length) return rows;
  const set = new Set(contasBancarias.map((n) => n.trim()).filter(Boolean));
  if (set.size === 0) return rows;
  return rows.filter((r) => {
    const nome = r.contaBancaria?.trim();
    return nome != null && nome !== '' && set.has(nome);
  });
}

function aplicarFiltrosLinhasNomus(
  rows: NomusFinanceiroRow[],
  idEmpresas: number[],
  contasBancarias?: string[],
): NomusFinanceiroRow[] {
  return filtrarContasBancarias(filtrarEmpresas(rows, idEmpresas), contasBancarias);
}

/** Nomes distintos (cb.nome) com lançamento no intervalo da DFC — sem filtro de conta bancária. */
export async function listarContasBancariasNoPeriodoNomus(params: {
  idEmpresas: number[];
  dataInicio: string;
  dataFim: string;
}): Promise<{ nomes: string[]; erro?: string }> {
  const { rows, erro } = await carregarLinhasNomusFinanceiro();
  const base = filtrarEmpresas(rows, params.idEmpresas);
  const nomes = [
    ...new Set(
      base
        .filter((r) => linhaPossuiMovimentoNoPeriodoDfc(r, params.dataInicio, params.dataFim))
        .map((r) => r.contaBancaria!.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { nomes, erro };
}

function tipoContaNorm(t: string): string {
  return t.trim().toUpperCase();
}

function discriminadorCasa(r: NomusFinanceiroRow, discriminadores: NomusDiscriminadorDfc[]): boolean {
  const t = tipoContaNorm(r.tipoConta);
  return discriminadores.some((d) => t === d);
}

/** Receitas: bloco 1 (af R) + bloco 2 (lf órfão R/LR com af.id is null). */
function linhaEhReceitaNomus(r: NomusFinanceiroRow): boolean {
  const t = tipoContaNorm(r.tipoConta);
  if (t === 'P' || t === 'LP') return false;
  if (r.tipoRef === 'A') return t === 'R';
  if (r.tipoRef === 'L') return t === 'R' || t === 'LR';
  return t === 'R' || t === 'LR';
}

function linhaIncluirDiscriminador(
  r: NomusFinanceiroRow,
  discriminadores: NomusDiscriminadorDfc[],
): boolean {
  const ehReceita =
    discriminadores.includes('R') || discriminadores.includes('LR');
  const soReceita = ehReceita && !discriminadores.includes('P') && !discriminadores.includes('LP');
  if (soReceita) return linhaEhReceitaNomus(r);
  return discriminadorCasa(r, discriminadores);
}

/** id na árvore DFC: tenta idPlanoContas, depois nome do plano. */
function resolverIdContaNomus(r: Pick<NomusFinanceiroRow, 'idPlanoContas' | 'planoContas'>): number | null {
  return resolverIdContaFinanceiroDfc(r.idPlanoContas, r.planoContas);
}

function empresaDetalheNomus(r: Pick<NomusFinanceiroRow, 'empresa' | 'idEmpresa'>): string | null {
  const nome = r.empresa?.trim();
  if (nome) return nome;
  const id = resolverIdEmpresaDfc(r) ?? r.idEmpresa;
  return labelEmpresaDfc(id);
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

function linhaEmAberto(r: NomusFinanceiroRow): boolean {
  return formatYmd(r.dataBaixa) == null;
}

/** Linha com movimento no intervalo da DFC (retrospectivo ou projeção), alinhado ao controller. */
function linhaPossuiMovimentoNoPeriodoDfc(
  r: NomusFinanceiroRow,
  dataInicio: string,
  dataFim: string,
): boolean {
  const nome = r.contaBancaria?.trim();
  if (!nome) return false;

  const hoje = hojeYmdLocal();
  const retroFim = minYmd(dataFim, hoje);
  if (dataInicio <= retroFim) {
    const baixa = formatYmd(r.dataBaixa);
    if (baixa && baixa >= dataInicio && baixa <= retroFim) return true;
  }

  const projInicio = maxYmd(dataInicio, amanhaYmdLocal());
  if (projInicio <= dataFim && linhaEmAberto(r)) {
    const venc = formatYmd(r.dataVencimento);
    if (venc && venc > hoje && venc >= projInicio && venc <= dataFim) return true;
  }

  return false;
}

function idEmpresaResolvidoNomus(r: NomusFinanceiroRow): number {
  return resolverIdEmpresaDfc(r) ?? r.idEmpresa;
}

function pushContribuicaoNomus(
  out: DfcContribuicaoLinha[],
  r: NomusFinanceiroRow,
  idConta: number,
  dataBucket: string,
  valor: number,
): void {
  if (!idConta || !dataBucket || !Number.isFinite(valor) || valor === 0) return;
  out.push({
    idContaFinanceiro: idConta,
    valor,
    idEmpresa: idEmpresaResolvidoNomus(r),
    empresa: r.empresa?.trim() || null,
    contaBancaria: r.contaBancaria?.trim() || null,
    codigoConta: r.codigoConta,
    tipoRef: r.tipoRef,
    dataBucket,
  });
}

/** Contribuições Nomus (todas empresas da carga, sem filtro de conta/prioridade). */
export async function coletarContribuicoesNomus(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
}): Promise<{ contribuicoes: DfcContribuicaoLinha[]; erro?: string }> {
  const { dataInicio, dataFim, idEmpresas } = params;
  const { rows: raw, erro } = await carregarLinhasNomusFinanceiro();
  if (erro && raw.length === 0) return { contribuicoes: [], erro };

  const rows = filtrarEmpresas(raw, idEmpresas);
  const contribuicoes: DfcContribuicaoLinha[] = [];
  const hoje = hojeYmdLocal();
  const retroFim = minYmd(dataFim, hoje);
  const projInicio = maxYmd(dataInicio, amanhaYmdLocal());

  if (dataInicio <= retroFim) {
    for (const r of rows) {
      if (!linhaIncluirDiscriminador(r, ['P', 'R', 'LR', 'LP'])) continue;
      const ymd = formatYmd(r.dataBaixa);
      if (!ymd || ymd < dataInicio || ymd > retroFim) continue;
      const t = tipoContaNorm(r.tipoConta);
      if (t !== 'P' && t !== 'LP' && linhaEmAberto(r)) continue;
      const idConta = resolverIdContaNomus(r);
      if (idConta == null || idConta <= 0) continue;
      pushContribuicaoNomus(contribuicoes, r, idConta, ymd, r.valorBaixado);
    }
  }

  if (projInicio <= dataFim) {
    for (const r of rows) {
      if (!linhaIncluirDiscriminador(r, ['P', 'R', 'LR'])) continue;
      if (!linhaEmAberto(r)) continue;
      const t = tipoContaNorm(r.tipoConta);
      if (t === 'LP') continue;
      const ymd = formatYmd(r.dataVencimento);
      if (!ymd || ymd <= hoje) continue;
      if (ymd < projInicio || ymd > dataFim) continue;
      const saldo = r.saldoBaixar;
      if (saldo <= 0) continue;
      const idConta = resolverIdContaNomus(r);
      if (idConta == null || idConta <= 0) continue;
      pushContribuicaoNomus(contribuicoes, r, idConta, ymd, saldo);
    }
  }

  return { contribuicoes, erro };
}

export async function queryDfcNomusRetroAgregado(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  discriminadores: NomusDiscriminadorDfc[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const { dataBaixaInicio, dataBaixaFim, granularidade, idEmpresas, contasBancarias, discriminadores, filtroPrioridade } =
    params;
  const { rows: raw, erro } = await carregarLinhasNomusFinanceiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const rows = aplicarFiltrosLinhasNomus(raw, idEmpresas, contasBancarias);
  const map = new Map<string, number>();

  const ehReceita =
    discriminadores.includes('R') || discriminadores.includes('LR');
  for (const r of rows) {
    if (!linhaIncluirDiscriminador(r, discriminadores)) continue;
    const ymd = formatYmd(r.dataBaixa);
    if (!ymd || ymd < dataBaixaInicio || ymd > dataBaixaFim) continue;
    if (!ehReceita && linhaEmAberto(r)) continue;
    const idConta = resolverIdContaNomus(r);
    if (idConta == null || idConta <= 0) continue;
    if (
      filtroPrioridade &&
      !linhaPassaFiltroPrioridade(
        r.idEmpresa,
        r.codigoConta,
        idConta,
        r.tipoRef,
        filtroPrioridade,
      )
    ) {
      continue;
    }
    const valor = r.valorBaixado;
    if (valor === 0) continue;
    const periodo = periodoFromYmd(ymd, granularidade);
    agregarLinhas(map, idConta, periodo, valor);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

export async function queryDfcNomusProjecaoAgregado(params: {
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  discriminadores: NomusDiscriminadorDfc[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  const {
    dataVencimentoInicio,
    dataVencimentoFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    discriminadores,
    filtroPrioridade,
  } = params;
  const { rows: raw, erro } = await carregarLinhasNomusFinanceiro();
  if (erro && raw.length === 0) return { linhas: [], erro };

  const rows = aplicarFiltrosLinhasNomus(raw, idEmpresas, contasBancarias);
  const map = new Map<string, number>();
  const hoje = hojeYmdLocal();

  const ehReceita =
    discriminadores.includes('R') || discriminadores.includes('LR');
  for (const r of rows) {
    if (!linhaIncluirDiscriminador(r, discriminadores)) continue;
    if (!ehReceita && !linhaEmAberto(r)) continue;
    if (ehReceita && formatYmd(r.dataBaixa)) continue;
    const ymd = formatYmd(r.dataVencimento);
    if (!ymd || ymd <= hoje) continue;
    if (ymd < dataVencimentoInicio || ymd > dataVencimentoFim) continue;
    const saldo = r.saldoBaixar;
    if (saldo <= 0) continue;
    const idConta = resolverIdContaNomus(r);
    if (idConta == null || idConta <= 0) continue;
    if (
      filtroPrioridade &&
      !linhaPassaFiltroPrioridade(
        r.idEmpresa,
        r.codigoConta,
        idConta,
        r.tipoRef,
        filtroPrioridade,
      )
    ) {
      continue;
    }
    const periodo = periodoFromYmd(ymd, granularidade);
    agregarLinhas(map, idConta, periodo, saldo);
  }

  return { linhas: mapParaLinhas(map, granularidade), erro };
}

export async function queryDfcNomusDetalhe(params: {
  modo: 'retro' | 'proj';
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  idsContaFinanceiro: number[];
  periodoBucket?: string | null;
  discriminadores: NomusDiscriminadorDfc[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  const {
    modo,
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    idsContaFinanceiro,
    periodoBucket,
    discriminadores,
    filtroPrioridade,
  } = params;
  const idsSet = new Set(idsContaFinanceiro.filter((n) => n > 0));
  if (idsSet.size === 0) return { detalhes: [] };

  const { rows: raw, erro } = await carregarLinhasNomusFinanceiro();
  if (erro && raw.length === 0) return { detalhes: [], erro };

  const rows = aplicarFiltrosLinhasNomus(raw, idEmpresas, contasBancarias);
  const hoje = hojeYmdLocal();
  const detalhes: DfcAgendamentoDetalheRow[] = [];

  for (const r of rows) {
    if (!linhaIncluirDiscriminador(r, discriminadores)) continue;
    const idConta = resolverIdContaNomus(r);
    if (idConta == null || !idsSet.has(idConta)) continue;
    if (
      filtroPrioridade &&
      !linhaPassaFiltroPrioridade(
        r.idEmpresa,
        r.codigoConta,
        idConta,
        r.tipoRef,
        filtroPrioridade,
      )
    ) {
      continue;
    }
    if (modo === 'retro') {
      if (linhaEmAberto(r)) continue;
      const dataBaixa = formatYmd(r.dataBaixa);
      if (!dataBaixa || dataBaixa < dataInicio || dataBaixa > dataFim) continue;
      const periodo = periodoFromYmd(dataBaixa, granularidade);
      if (periodoBucket && periodo !== periodoBucket) continue;
      if (r.valorBaixado === 0) continue;
      detalhes.push({
        id: r.codigoConta,
        descricaoLancamento: r.descricaoLancamento,
        nome: r.nomeRazaoSocial ?? r.clienteFornecedor,
        dataVencimento: formatYmd(r.dataVencimento),
        dataBaixa,
        valorBaixado: r.valorBaixado,
        tipoRef: r.tipoRef,
        idEmpresa: idEmpresaResolvidoNomus(r),
        idContaFinanceiro: idConta,
        empresa: empresaDetalheNomus(r),
      });
      continue;
    }

    if (!linhaEmAberto(r)) continue;
    if (r.tipoRef === 'L' && formatYmd(r.dataBaixa)) continue;
    const dataVenc = formatYmd(r.dataVencimento);
    if (!dataVenc || dataVenc <= hoje) continue;
    if (dataVenc < dataInicio || dataVenc > dataFim) continue;
    const periodo = periodoFromYmd(dataVenc, granularidade);
    if (periodoBucket && periodo !== periodoBucket) continue;
    if (r.saldoBaixar <= 0) continue;
    detalhes.push({
      id: r.codigoConta,
      descricaoLancamento: r.descricaoLancamento,
      nome: r.nomeRazaoSocial ?? r.clienteFornecedor,
      dataVencimento: dataVenc,
      dataBaixa: null,
      valorBaixado: r.saldoBaixar,
      tipoRef: r.tipoRef,
      idEmpresa: idEmpresaResolvidoNomus(r),
      idContaFinanceiro: idConta,
      empresa: empresaDetalheNomus(r),
    });
  }

  detalhes.sort((a, b) => b.valorBaixado - a.valorBaixado);
  return { detalhes: detalhes.slice(0, 2000), erro };
}
