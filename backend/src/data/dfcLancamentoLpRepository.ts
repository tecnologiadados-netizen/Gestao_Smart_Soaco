/**
 * DFC — lancamentofinanceiro com discriminador LP (sem vínculo de agendamento), por dataLancamento.
 * Soma com agendamentos efetivos na API de grade/detalhe.
 */

import type { DfcAgendamentoDetalheRow, DfcAgendamentoLinha, DfcAgendamentoGranularidade } from './dfcAgendamentoRepository.js';
import type { DfcPrioridadeFilterResolvido } from './dfcPrioridadeFilter.js';
import { queryDfcNomusDetalhe, queryDfcNomusRetroAgregado } from './dfcNomusRepository.js';
import { formatSqlDatePeriod, formatSqlDateYmd } from './dfcDateUtils.js';

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function formatYmdFromRow(periodoRaw: unknown, granularidade: DfcAgendamentoGranularidade): string {
  return formatSqlDatePeriod(periodoRaw, granularidade);
}

function buildSqlWhereLp(idEmpresas: number[]): string {
  const inClause = idEmpresas.map(() => '?').join(', ');
  return `
FROM lancamentofinanceiro lf
LEFT JOIN pessoa pe ON pe.id = lf.idPessoa
LEFT JOIN contafinanceiro cf ON cf.id = lf.idContaFinanceiro
WHERE DATE(lf.dataLancamento) BETWEEN ? AND ?
  AND lf.idEmpresa IN (${inClause})
  AND lf.discriminador = 'LP'
  AND lf.idAgendamentoPagamento IS NULL
  AND lf.idContaFinanceiro IS NOT NULL
`.trim();
}

function buildSqlAgregLp(
  granularidade: DfcAgendamentoGranularidade,
  idEmpresas: number[],
  filtroSqlPrioridade: string
): string {
  const fmt = granularidade === 'mes' ? "'%Y-%m'" : "'%Y-%m-%d'";
  return `
SELECT
  lf.idContaFinanceiro AS idContaFinanceiro,
  DATE_FORMAT(lf.dataLancamento, ${fmt}) AS periodo,
  SUM(lf.valor) AS valor
${buildSqlWhereLp(idEmpresas)}
  ${filtroSqlPrioridade}
GROUP BY lf.idContaFinanceiro, DATE_FORMAT(lf.dataLancamento, ${fmt})
ORDER BY periodo, idContaFinanceiro
`.trim();
}

/**
 * Soma de lf.valor por idContaFinanceiro e bucket (mês/dia) por dataLancamento.
 */
export async function queryDfcLancamentosLpAgrupado(params: {
  dataLancamentoInicio: string;
  dataLancamentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  return queryDfcNomusRetroAgregado({
    dataBaixaInicio: params.dataLancamentoInicio,
    dataBaixaFim: params.dataLancamentoFim,
    granularidade: params.granularidade,
    idEmpresas: params.idEmpresas,
    contasBancarias: params.contasBancarias,
    discriminadores: ['LP'],
    filtroPrioridade: params.filtroPrioridade,
  });
}

function formatYmdFromSqlDate(v: unknown): string | null {
  return formatSqlDateYmd(v);
}

/**
 * Linhas de LP para o mesmo detalhe do modal (alinhado a DfcAgendamentoDetalheRow; data baixa = dataLancamento).
 */
export async function queryDfcLancamentosLpDetalhe(params: {
  dataLancamentoInicio: string;
  dataLancamentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  idsContaFinanceiro: number[];
  periodoBucket?: string | null;
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  return queryDfcNomusDetalhe({
    modo: 'retro',
    dataInicio: params.dataLancamentoInicio,
    dataFim: params.dataLancamentoFim,
    granularidade: params.granularidade,
    idEmpresas: params.idEmpresas,
    contasBancarias: params.contasBancarias,
    idsContaFinanceiro: params.idsContaFinanceiro,
    periodoBucket: params.periodoBucket,
    discriminadores: ['LP'],
    filtroPrioridade: params.filtroPrioridade,
  });
}

/**
 * Soma agregado agendamento + agregado LP (mesma chave idContaFinanceiro + periodo).
 */
export function mergeDfcAgregadoLinhas(
  a: DfcAgendamentoLinha[],
  b: DfcAgendamentoLinha[]
): DfcAgendamentoLinha[] {
  const byConta = new Map<number, Map<string, number>>();
  function add(rows: DfcAgendamentoLinha[]) {
    for (const { idContaFinanceiro, periodo, valor } of rows) {
      if (!byConta.has(idContaFinanceiro)) byConta.set(idContaFinanceiro, new Map());
      const p = byConta.get(idContaFinanceiro)!;
      p.set(periodo, (p.get(periodo) ?? 0) + valor);
    }
  }
  add(a);
  add(b);
  const out: DfcAgendamentoLinha[] = [];
  for (const [id, periods] of byConta) {
    for (const [periodo, valor] of periods) {
      out.push({ idContaFinanceiro: id, periodo, valor });
    }
  }
  return out;
}

const MAX_DETALHE = 2000;

/** Une detalhe agendamento + detalhe LP, ordena por valor e respeita limite. */
export function mergeDfcDetalheOrdenado(
  a: DfcAgendamentoDetalheRow[],
  b: DfcAgendamentoDetalheRow[]
): { detalhes: DfcAgendamentoDetalheRow[]; truncado: boolean } {
  return mergeDfcDetalheOrdenadoMany([a, b]);
}

/** Une vários conjuntos de detalhe (ex.: P + LP + receitas R/LR), ordena e aplica um único limite. */
export function mergeDfcDetalheOrdenadoMany(
  parts: DfcAgendamentoDetalheRow[][]
): { detalhes: DfcAgendamentoDetalheRow[]; truncado: boolean } {
  const m = parts.flat().sort((u, v) => v.valorBaixado - u.valorBaixado);
  return {
    detalhes: m.slice(0, MAX_DETALHE),
    truncado: m.length > MAX_DETALHE,
  };
}
