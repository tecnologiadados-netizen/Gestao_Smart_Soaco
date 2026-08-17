import { buildEmpresaFilter } from './empresaConfig.js';
import { sqlPagouAposPrazoEfetivoMysql } from './prazoEfetivoPagamentoSql.js';

type QueryParams = (string | number)[];

const RECEBER = "('R', 'CR', 'NCC')";
const TIPO_CONTA = 'af.tipoConta IN (1, 3)';
const PENDENTE = 'IFNULL(af.baixada, 0) = 0';
const BAIXADA = 'af.baixada = 1';

function ymdValido(value?: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()));
}

function clausulaVencimento(
  coluna: string,
  de?: string | null,
  ate?: string | null,
): { clause: string; params: QueryParams } {
  const params: QueryParams = [];
  let clause = '';
  if (ymdValido(de)) {
    clause += ` AND ${coluna} >= ? `;
    params.push(de.trim());
  }
  if (ymdValido(ate)) {
    clause += ` AND ${coluna} < DATE_ADD(?, INTERVAL 1 DAY) `;
    params.push(ate.trim());
  }
  return { clause, params };
}

const NF_NAO_CANCELADA = `
  AND NOT EXISTS (
    SELECT 1 FROM nfe nfes
    WHERE nfes.idDocumentoEstoque = af.idDocumentoSaida AND nfes.status = 7
  )
  AND NOT EXISTS (
    SELECT 1 FROM nfe nfee
    WHERE nfee.idDocumentoEstoque = af.idDocumentoEntrada AND nfee.status = 7
  )
  AND NOT EXISTS (
    SELECT 1 FROM nfse
    WHERE nfse.idDocumentoServico = af.idDocumentoSaida AND nfse.status = 4
  )
`;

function joinLfRecuperado(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('afScope.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  const empresaScope = empresaFilter.clause.replace(/af\./g, 'afScope.');
  return {
    sql: `
LEFT JOIN (
  SELECT
    lf.idAgendamentoRecebimento AS idAf,
    MAX(lf.dataLancamento) AS dataLanc
  FROM lancamentofinanceiro lf
  INNER JOIN agendamentofinanceiro afScope ON afScope.id = lf.idAgendamentoRecebimento
  WHERE lf.idAgendamentoRecebimento IS NOT NULL
    AND afScope.discriminador IN ${RECEBER}
    AND afScope.tipoConta IN (1, 3)
    AND afScope.baixada = 1
    AND IFNULL(afScope.cancelada, 0) = 0
    AND afScope.dataVencimento IS NOT NULL
    ${empresaScope}
    ${periodo.clause}
  GROUP BY lf.idAgendamentoRecebimento
) lfRec ON lfRec.idAf = af.id
`,
    params: [...empresaFilter.params, ...periodo.params],
  };
}

const DATA_PAG = 'DATE(COALESCE(lfRec.dataLanc, af.dataBaixa))';
const MESMO_MES = `DATE_FORMAT(af.dataVencimento, '%Y-%m') = DATE_FORMAT(COALESCE(lfRec.dataLanc, af.dataBaixa), '%Y-%m')`;

const WHERE_ABERTOS = `
WHERE af.discriminador IN ${RECEBER}
  AND ${TIPO_CONTA}
  AND af.saldoBaixar > 0
  ${NF_NAO_CANCELADA}
  AND ${PENDENTE}
  AND af.dataVencimento < CURDATE()
`;

const WHERE_RECUP = `
WHERE af.discriminador IN ${RECEBER}
  AND ${TIPO_CONTA}
  AND ${BAIXADA}
  AND IFNULL(af.cancelada, 0) = 0
  ${NF_NAO_CANCELADA}
  AND af.dataVencimento IS NOT NULL
  AND COALESCE(lfRec.dataLanc, af.dataBaixa) IS NOT NULL
  AND ${sqlPagouAposPrazoEfetivoMysql('af.dataVencimento', 'COALESCE(lfRec.dataLanc, af.dataBaixa)')}
`;

export function buildPainelAbertosEmpresaNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  return {
    sql: `
      SELECT
        IFNULL(e.nome, 'Sem empresa') AS chave,
        COUNT(*) AS qtd,
        COALESCE(SUM(ABS(af.saldoBaixar)), 0) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      ${WHERE_ABERTOS}
        ${empresaFilter.clause}
        ${periodo.clause}
      GROUP BY e.nome
    `,
    params: [...empresaFilter.params, ...periodo.params],
  };
}

export function buildPainelAbertosCondicaoNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  return {
    sql: `
      SELECT
        IFNULL(fp.nome, 'Sem condição') AS chave,
        COUNT(*) AS qtd,
        COALESCE(SUM(ABS(af.saldoBaixar)), 0) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
      ${WHERE_ABERTOS}
        ${empresaFilter.clause}
        ${periodo.clause}
      GROUP BY fp.nome
    `,
    params: [...empresaFilter.params, ...periodo.params],
  };
}

export function buildPainelRecuperadoResumoNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  const lf = joinLfRecuperado(opts);
  const valor = 'ABS(IFNULL(af.valorBaixado, IFNULL(af.valorBaixar, 0)))';
  return {
    sql: `
      SELECT
        COUNT(*) AS qtdTotal,
        COALESCE(SUM(${valor}), 0) AS valorTotal,
        SUM(CASE WHEN ${MESMO_MES} THEN 1 ELSE 0 END) AS qtdMesmoMes,
        COALESCE(SUM(CASE WHEN ${MESMO_MES} THEN ${valor} ELSE 0 END), 0) AS valorMesmoMes
      FROM agendamentofinanceiro af
      ${lf.sql}
      ${WHERE_RECUP}
        ${empresaFilter.clause}
        ${periodo.clause}
    `,
    params: [...lf.params, ...empresaFilter.params, ...periodo.params],
  };
}

export function buildPainelAbertosDetalheNomusQuery(opts: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
  chaveEmpresa?: string | null;
  chaveCondicao?: string | null;
  limit: number;
  offset: number;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts.vencimentoDe, opts.vencimentoAte);
  const extra: string[] = [];
  const extraParams: QueryParams = [];
  if (opts.chaveEmpresa) {
    extra.push(opts.chaveEmpresa === 'Sem empresa' ? ' AND e.nome IS NULL ' : ' AND e.nome = ? ');
    if (opts.chaveEmpresa !== 'Sem empresa') extraParams.push(opts.chaveEmpresa);
  }
  if (opts.chaveCondicao) {
    extra.push(opts.chaveCondicao === 'Sem condição' ? ' AND fp.nome IS NULL ' : ' AND fp.nome = ? ');
    if (opts.chaveCondicao !== 'Sem condição') extraParams.push(opts.chaveCondicao);
  }
  return {
    sql: `
      SELECT
        af.id AS codigo,
        e.nome AS empresa,
        fp.nome AS formaPagamento,
        pes.nome AS pessoa,
        DATE(af.dataVencimento) AS dataVencimento,
        ABS(af.saldoBaixar) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
      LEFT JOIN pessoa pes ON pes.id = af.idPessoa
      ${WHERE_ABERTOS}
        ${empresaFilter.clause}
        ${periodo.clause}
        ${extra.join('')}
      ORDER BY af.dataVencimento DESC, af.id DESC
      LIMIT ? OFFSET ?
    `,
    params: [...empresaFilter.params, ...periodo.params, ...extraParams, opts.limit, opts.offset],
  };
}

export function buildPainelRecuperadosDetalheNomusQuery(opts: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
  classe?: 'mesmo_mes' | 'outros_meses' | 'total';
  limit: number;
  offset: number;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts.vencimentoDe, opts.vencimentoAte);
  const lf = joinLfRecuperado(opts);
  let classeClause = '';
  if (opts.classe === 'mesmo_mes') classeClause = ` AND ${MESMO_MES} `;
  if (opts.classe === 'outros_meses') classeClause = ` AND NOT (${MESMO_MES}) `;
  return {
    sql: `
      SELECT
        af.id AS codigo,
        e.nome AS empresa,
        fp.nome AS formaPagamento,
        pes.nome AS pessoa,
        DATE(af.dataVencimento) AS dataVencimento,
        DATE(af.dataBaixa) AS dataBaixa,
        ${DATA_PAG} AS dataRecebimento,
        ABS(IFNULL(af.valorBaixado, IFNULL(af.valorBaixar, 0))) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
      LEFT JOIN pessoa pes ON pes.id = af.idPessoa
      ${lf.sql}
      ${WHERE_RECUP}
        ${empresaFilter.clause}
        ${periodo.clause}
        ${classeClause}
      ORDER BY af.dataVencimento DESC, af.id DESC
      LIMIT ? OFFSET ?
    `,
    params: [...lf.params, ...empresaFilter.params, ...periodo.params, opts.limit, opts.offset],
  };
}
