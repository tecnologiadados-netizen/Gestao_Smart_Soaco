/**
 * DFC — agendamentos financeiros efetivos (Nomus, somente leitura).
 * Filtro por data de baixa; agregação por conta e dia ou mês.
 */

import { getNomusPool } from '../config/nomusDb.js';
import { type DfcPrioridadeFilterResolvido } from './dfcPrioridadeFilter.js';
import type { DfcTipoRefLancamento } from './dfcPrioridadeConstantes.js';
import {
  queryDfcNomusDetalhe,
  queryDfcNomusProjecaoAgregado,
  queryDfcNomusRetroAgregado,
} from './dfcNomusRepository.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';

export type DfcAgendamentoGranularidade = 'dia' | 'mes';

export interface DfcAgendamentoLinha {
  idContaFinanceiro: number;
  periodo: string;
  valor: number;
}

const SQL_PG_JOIN = `
LEFT JOIN (
  SELECT idAgendamentoPagamento, MAX(l.dataLancamento) AS dataLancamento, SUM(l.valor) AS valorpago
  FROM lancamentofinanceiro l
  WHERE idAgendamentoPagamento IS NOT NULL
  GROUP BY idAgendamentoPagamento
) pg ON pg.idAgendamentoPagamento = af.id
`.trim();

const SQL_BASE_FROM = `
FROM agendamentofinanceiro af
LEFT JOIN pessoa pe ON pe.id = af.idPessoa
LEFT JOIN contafinanceiro cf ON cf.id = af.idContaFinanceiro
LEFT JOIN (
  SELECT DISTINCT idAgendamentoPagamento
  FROM lancamentofinanceiro l
  WHERE idAgendamentoPagamento IS NOT NULL
) sn ON sn.idAgendamentoPagamento = af.id
${SQL_PG_JOIN}
`.trim();

function buildSqlWhereEfetivoPg(idEmpresas: number[]): string {
  const inClause = idEmpresas.map(() => '?').join(', ');
  return `
WHERE DATE(pg.dataLancamento) BETWEEN ? AND ?
  AND af.discriminador = 'P'
  AND af.idEmpresa IN (${inClause})
  AND af.idPedidoCompra IS NULL
  AND af.dataBaixa IS NOT NULL
  AND af.idContaFinanceiro IS NOT NULL
  AND CASE
    WHEN (sn.idAgendamentoPagamento IS NULL AND DATE(af.dataBaixa) IS NOT NULL) THEN 'Sem Numerario'
    ELSE 'Efetiva'
  END = 'Efetiva'
`.trim();
}

const SQL_VALOR_BAIXADO_EXPR = `
CASE
  WHEN (pg.valorpago IS NULL OR pg.valorpago = 0) THEN
    CASE WHEN (af.valorBaixado IS NULL OR af.valorBaixado = 0) THEN af.saldoBaixar ELSE af.valorBaixado END
  ELSE pg.valorpago
END
`.trim();

function buildSqlAgregado(
  granularidade: DfcAgendamentoGranularidade,
  idEmpresas: number[],
  filtroSqlPrioridade: string
): string {
  const fmt = granularidade === 'mes' ? "'%Y-%m'" : "'%Y-%m-%d'";
  return `
SELECT
  af.idContaFinanceiro AS idContaFinanceiro,
  DATE_FORMAT(pg.dataLancamento, ${fmt}) AS periodo,
  SUM((${SQL_VALOR_BAIXADO_EXPR})) AS valor
${SQL_BASE_FROM}
${buildSqlWhereEfetivoPg(idEmpresas)}
${filtroSqlPrioridade}
GROUP BY af.idContaFinanceiro, DATE_FORMAT(pg.dataLancamento, ${fmt})
ORDER BY periodo, idContaFinanceiro
`.trim();
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Linha detalhada para tooltip (campos alinhados ao Nomus). */
export interface DfcAgendamentoDetalheRow {
  id: number;
  descricaoLancamento: string | null;
  nome: string | null;
  dataVencimento: string | null;
  /** Data de baixa/pagamento (DFC). Na DRE Shop9/Nomus por competência pode ser null. */
  dataBaixa: string | null;
  /** Data de competência (DRE). Alinhada à grade quando informada. */
  dataCompetencia?: string | null;
  valorBaixado: number;
  /** Universo do campo `id`: 'A' = agendamentofinanceiro.id, 'L' = lancamentofinanceiro.id. */
  tipoRef: DfcTipoRefLancamento;
  /** idEmpresa Nomus desta linha (para chave da prioridade). */
  idEmpresa: number;
  /** idContaFinanceiro Nomus (para chave da prioridade pelo plano de contas). */
  idContaFinanceiro: number | null;
  /** Nome da empresa (Nomus/Shop9) para exibição no modal. */
  empresa: string | null;
}

function formatYmdFromSqlDate(v: unknown): string | null {
  return formatSqlDateYmd(v);
}

/**
 * Lançamentos no intervalo, opcionalmente filtrados a um bucket (mês ou dia) por data de lançamento do pagamento (pg).
 * `periodoBucket`: YYYY-MM (mensal) ou YYYY-MM-DD (diário); omitir para todo o intervalo.
 */
export async function queryDfcAgendamentosDetalhe(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  idsContaFinanceiro: number[];
  periodoBucket?: string | null;
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  return queryDfcNomusDetalhe({
    modo: 'retro',
    dataInicio: params.dataBaixaInicio,
    dataFim: params.dataBaixaFim,
    granularidade: params.granularidade,
    idEmpresas: params.idEmpresas,
    contasBancarias: params.contasBancarias,
    idsContaFinanceiro: params.idsContaFinanceiro,
    periodoBucket: params.periodoBucket,
    discriminadores: ['P'],
    filtroPrioridade: params.filtroPrioridade,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJEÇÃO FUTURA — Pagamentos (P) não baixados, bucket por dataVencimento
// ─────────────────────────────────────────────────────────────────────────────

function buildSqlProjPgAgregado(
  granularidade: DfcAgendamentoGranularidade,
  idEmpresas: number[],
  filtroSqlPrioridade: string
): string {
  const fmt = granularidade === 'mes' ? "'%Y-%m'" : "'%Y-%m-%d'";
  const inClause = idEmpresas.map(() => '?').join(', ');
  return `
SELECT
  af.idContaFinanceiro AS idContaFinanceiro,
  DATE_FORMAT(af.dataVencimento, ${fmt}) AS periodo,
  SUM(af.saldoBaixar) AS valor
FROM agendamentofinanceiro af
WHERE DATE(af.dataVencimento) BETWEEN ? AND ?
  AND af.discriminador = 'P'
  AND af.idEmpresa IN (${inClause})
  AND af.idPedidoCompra IS NULL
  AND af.dataBaixa IS NULL
  AND af.saldoBaixar > 0
  AND af.idContaFinanceiro IS NOT NULL
  ${filtroSqlPrioridade}
GROUP BY af.idContaFinanceiro, DATE_FORMAT(af.dataVencimento, ${fmt})
ORDER BY periodo, idContaFinanceiro
`.trim();
}

/**
 * Projeção futura: pagamentos (P) NÃO baixados, bucket por dataVencimento, valor = saldoBaixar.
 */
export async function queryDfcAgendamentosProjecao(params: {
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  return queryDfcNomusProjecaoAgregado({
    ...params,
    discriminadores: ['P'],
  });
}

/**
 * Detalhe de projeção futura: pagamentos (P) NÃO baixados por dataVencimento.
 */
export async function queryDfcAgendamentosProjecaoDetalhe(params: {
  dataVencimentoInicio: string;
  dataVencimentoFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  idsContaFinanceiro: number[];
  periodoBucket?: string | null;
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  return queryDfcNomusDetalhe({
    modo: 'proj',
    dataInicio: params.dataVencimentoInicio,
    dataFim: params.dataVencimentoFim,
    granularidade: params.granularidade,
    idEmpresas: params.idEmpresas,
    contasBancarias: params.contasBancarias,
    idsContaFinanceiro: params.idsContaFinanceiro,
    periodoBucket: params.periodoBucket,
    discriminadores: ['P'],
    filtroPrioridade: params.filtroPrioridade,
  });
}

/** Despesas de pagamento em aberto — alinhado aos KPIs vencidos/a vencer a pagar (agendamento P). */
export type DfcDespesaPagamentoSituacao = 'vencido' | 'a_vencer';

export interface DfcDespesaPagamentoEmAbertoRow {
  situacao: DfcDespesaPagamentoSituacao;
  id: number;
  idEmpresa: number;
  idContaFinanceiro: number | null;
  descricaoLancamento: string | null;
  nome: string | null;
  dataVencimento: string | null;
  saldoBaixar: number;
}

/**
 * Agendamentos (P) não baixados em aberto, no intervalo das datas da DFC:
 * - **vencido**: mesmo critério de `dfcKpisRepository` `sqlVencidosPagar` (vencimento no intervalo,
 *   vencimento &lt; LEAST(dataFim, CURDATE()), saldoBaixar &gt; 0, sem baixa…).
 * - **a_vencer**: mesmo critério de `sqlAVencerPagar` (entre GREATEST(dataInicio,CURDATE()) e dataFim…).
 *
 * Opcionalmente filtra contas (`idsContaFinanceiro` ou único legado `idContaFinanceiro`) e favorecidos (`nomesFornecedor` ⇔ TRIM(pe.nome)).
 */
export async function queryDfcDespesasPagamentoEmAberto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  idContaFinanceiro?: number | null;
  idsContaFinanceiro?: number[];
  nomesFornecedor?: string[];
}): Promise<{ linhas: DfcDespesaPagamentoEmAbertoRow[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'NOMUS_DB_URL não configurado' };

  const { dataInicio, dataFim, idEmpresas } = params;
  const mergedContaIds: number[] = [
    ...(params.idsContaFinanceiro ?? []).map((n) => Math.trunc(Number(n))),
  ];
  if (
    params.idContaFinanceiro != null &&
    Number.isFinite(params.idContaFinanceiro) &&
    params.idContaFinanceiro > 0
  ) {
    mergedContaIds.push(Math.trunc(params.idContaFinanceiro));
  }
  const idsConta = [...new Set(mergedContaIds.filter((n) => Number.isFinite(n) && n > 0))];

  const nomesFornecedor = [
    ...new Set((params.nomesFornecedor ?? []).map((s) => s.trim()).filter(Boolean)),
  ];

  const empInClause = idEmpresas.map(() => '?').join(', ');
  const contaClause =
    idsConta.length > 0 ? ` AND af.idContaFinanceiro IN (${idsConta.map(() => '?').join(', ')}) ` : '';
  const fornecedorClause =
    nomesFornecedor.length > 0 ? ` AND TRIM(pe.nome) IN (${nomesFornecedor.map(() => '?').join(', ')}) ` : '';

  const pushFiltros = (branchArgs: unknown[]) => {
    branchArgs.push(...idsConta, ...nomesFornecedor);
  };

  const sql = `
SELECT u.situacao, u.id, u.idEmpresa, u.idContaFinanceiro, u.descricaoLancamento, u.nome,
       u.dataVencimento, u.saldoBaixar
FROM (
  SELECT
    'vencido' AS situacao,
    af.id AS id,
    af.idEmpresa AS idEmpresa,
    af.idContaFinanceiro AS idContaFinanceiro,
    af.descricaoLancamento AS descricaoLancamento,
    pe.nome AS nome,
    DATE(af.dataVencimento) AS dataVencimento,
    af.saldoBaixar AS saldoBaixar
  FROM agendamentofinanceiro af
  LEFT JOIN pessoa pe ON pe.id = af.idPessoa
  WHERE DATE(af.dataVencimento) BETWEEN ? AND ?
    AND DATE(af.dataVencimento) < LEAST(?, CURDATE())
    AND af.dataBaixa IS NULL
    AND af.saldoBaixar > 0
    AND af.idEmpresa IN (${empInClause})
    AND af.idPedidoCompra IS NULL
    AND af.discriminador = 'P'
    AND af.idContaFinanceiro IS NOT NULL
    ${contaClause}${fornecedorClause}

  UNION ALL

  SELECT
    'a_vencer' AS situacao,
    af.id AS id,
    af.idEmpresa AS idEmpresa,
    af.idContaFinanceiro AS idContaFinanceiro,
    af.descricaoLancamento AS descricaoLancamento,
    pe.nome AS nome,
    DATE(af.dataVencimento) AS dataVencimento,
    af.saldoBaixar AS saldoBaixar
  FROM agendamentofinanceiro af
  LEFT JOIN pessoa pe ON pe.id = af.idPessoa
  WHERE DATE(af.dataVencimento) BETWEEN GREATEST(?, CURDATE()) AND ?
    AND af.dataBaixa IS NULL
    AND af.saldoBaixar > 0
    AND af.idEmpresa IN (${empInClause})
    AND af.idPedidoCompra IS NULL
    AND af.discriminador = 'P'
    AND af.idContaFinanceiro IS NOT NULL
    ${contaClause}${fornecedorClause}
) u
ORDER BY FIELD(u.situacao, 'vencido', 'a_vencer'), u.dataVencimento ASC, u.id DESC
LIMIT 2000
`.trim();

  const argsBranch1: unknown[] = [dataInicio, dataFim, dataFim, ...idEmpresas];
  pushFiltros(argsBranch1);
  const argsBranch2: unknown[] = [dataInicio, dataFim, ...idEmpresas];
  pushFiltros(argsBranch2);
  const args: unknown[] = [...argsBranch1, ...argsBranch2];

  try {
    const [rows] = (await pool.query(sql, args)) as [Record<string, unknown>[], unknown];
    const list = Array.isArray(rows) ? rows : [];
    const linhas: DfcDespesaPagamentoEmAbertoRow[] = list.map((r) => {
      const sit = r.situacao ?? r['situacao'];
      const situacao: DfcDespesaPagamentoSituacao =
        sit === 'a_vencer' ? 'a_vencer' : 'vencido';
      return {
        situacao,
        id: toInt(r.id ?? r['id']),
        idEmpresa: toInt(r.idEmpresa ?? r['idEmpresa']),
        idContaFinanceiro: r.idContaFinanceiro != null ? toInt(r.idContaFinanceiro) : null,
        descricaoLancamento: r.descricaoLancamento != null ? String(r.descricaoLancamento) : null,
        nome: r.nome != null ? String(r.nome) : null,
        dataVencimento: formatYmdFromSqlDate(r.dataVencimento ?? r['dataVencimento']),
        saldoBaixar: toNum(r.saldoBaixar ?? r['saldoBaixar']),
      };
    });
    return { linhas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcAgendamentoRepository] queryDfcDespesasPagamentoEmAberto:', msg);
    return { linhas: [], erro: msg };
  }
}

/** Favorecidos (`pessoa`) distintos entre despesas P em aberto no intervalo (vencidas + a vencer), mesmo universo do KPI da DFC. */
export async function queryDfcDespesasPagamentoFornecedorOpcoes(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
}): Promise<{ nomes: string[]; erro?: string }> {
  const pool = getNomusPool();
  if (!pool) return { nomes: [], erro: 'NOMUS_DB_URL não configurado' };

  const { dataInicio, dataFim, idEmpresas } = params;
  if (idEmpresas.length === 0) return { nomes: [] };

  const empInClause = idEmpresas.map(() => '?').join(', ');

  const sql = `
SELECT DISTINCT TRIM(pe.nome) AS nome
FROM agendamentofinanceiro af
LEFT JOIN pessoa pe ON pe.id = af.idPessoa
WHERE (
    (
      DATE(af.dataVencimento) BETWEEN ? AND ?
      AND DATE(af.dataVencimento) < LEAST(?, CURDATE())
    )
    OR (
      DATE(af.dataVencimento) BETWEEN GREATEST(?, CURDATE()) AND ?
    )
  )
  AND af.dataBaixa IS NULL
  AND af.saldoBaixar > 0
  AND af.idEmpresa IN (${empInClause})
  AND af.idPedidoCompra IS NULL
  AND af.discriminador = 'P'
  AND af.idContaFinanceiro IS NOT NULL
  AND pe.nome IS NOT NULL
  AND TRIM(pe.nome) <> ''
ORDER BY nome
LIMIT 800
`.trim();

  const args: unknown[] = [dataInicio, dataFim, dataFim, dataInicio, dataFim, ...idEmpresas];

  try {
    const [rows] = (await pool.query(sql, args)) as [Record<string, unknown>[], unknown];
    const list = Array.isArray(rows) ? rows : [];
    const nomes = list.map((r) => String(r.nome ?? r['nome'] ?? '').trim()).filter(Boolean);
    return { nomes: [...new Set(nomes)] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dfcAgendamentoRepository] queryDfcDespesasPagamentoFornecedorOpcoes:', msg);
    return { nomes: [], erro: msg };
  }
}

export async function queryDfcAgendamentosEfetivos(params: {
  dataBaixaInicio: string;
  dataBaixaFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias?: string[];
  filtroPrioridade?: DfcPrioridadeFilterResolvido;
}): Promise<{ linhas: DfcAgendamentoLinha[]; erro?: string }> {
  return queryDfcNomusRetroAgregado({
    ...params,
    discriminadores: ['P'],
  });
}
