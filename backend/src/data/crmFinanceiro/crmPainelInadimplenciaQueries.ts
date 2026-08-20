import { buildEmpresaFilter } from './empresaConfig.js';
import {
  AGENDAMENTO_ABERTO_EFETIVO,
  AGENDAMENTO_BAIXADA,
  AGENDAMENTO_PENDENTE,
  EXCLUIR_TITULO_DESCONTADO,
  TITULO_DESCONTADO_COND,
  VALOR_ABERTO_EFETIVO,
} from './crmQueries.js';
import { sqlPagouAposPrazoEfetivoMysql } from './prazoEfetivoPagamentoSql.js';

type QueryParams = (string | number)[];

const RECEBER = "('R', 'CR', 'NCC')";
const TIPO_CONTA = 'af.tipoConta IN (1, 3)';

/** Forma de pagamento do agendamento (boleto, cartão, transferência). */
const JOIN_FORMA = `LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento`;

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

function joinLfPagamento(opts?: {
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

const VALOR_COORTE = `CASE
  WHEN ${AGENDAMENTO_ABERTO_EFETIVO} THEN ABS(${VALOR_ABERTO_EFETIVO})
  ELSE ABS(IFNULL(af.valorBaixado, IFNULL(af.valorBaixar, 0)))
END`;

const AINDA_INADIMPLENTE = `(${AGENDAMENTO_ABERTO_EFETIVO} AND (
  (${AGENDAMENTO_PENDENTE} AND af.saldoBaixar > 0)
  OR (${AGENDAMENTO_BAIXADA} AND IFNULL(af.valorBaixar, 0) <> 0)
))`;

const ATRASOU_PAGAMENTO = `(${AINDA_INADIMPLENTE} OR (
  ${AGENDAMENTO_BAIXADA}
  AND NOT ${TITULO_DESCONTADO_COND}
  AND COALESCE(lfRec.dataLanc, af.dataBaixa) IS NOT NULL
  AND ${sqlPagouAposPrazoEfetivoMysql('af.dataVencimento', 'COALESCE(lfRec.dataLanc, af.dataBaixa)')}
))`;

const WHERE_COORTE = `
WHERE af.discriminador IN ${RECEBER}
  AND ${TIPO_CONTA}
  AND IFNULL(af.cancelada, 0) = 0
  ${NF_NAO_CANCELADA}
  AND af.dataVencimento IS NOT NULL
  AND af.dataVencimento < CURDATE()
  AND (
    (${AGENDAMENTO_PENDENTE} AND af.saldoBaixar > 0)
    OR (${AGENDAMENTO_BAIXADA} AND ${TITULO_DESCONTADO_COND} AND IFNULL(af.valorBaixar, 0) <> 0)
    OR (${AGENDAMENTO_BAIXADA} AND NOT ${TITULO_DESCONTADO_COND})
  )
`;

export function buildPainelSerieMensalNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  const lf = joinLfPagamento(opts);
  return {
    sql: `
      SELECT
        DATE_FORMAT(af.dataVencimento, '%Y-%m') AS mes,
        COUNT(*) AS qtdVencido,
        COALESCE(SUM(${VALOR_COORTE}), 0) AS valorVencido,
        SUM(CASE WHEN ${AINDA_INADIMPLENTE} THEN 1 ELSE 0 END) AS qtdAberto,
        COALESCE(SUM(CASE WHEN ${AINDA_INADIMPLENTE} THEN ${VALOR_COORTE} ELSE 0 END), 0) AS valorAberto,
        SUM(CASE WHEN ${ATRASOU_PAGAMENTO} THEN 1 ELSE 0 END) AS qtdAtraso,
        COALESCE(SUM(CASE WHEN ${ATRASOU_PAGAMENTO} THEN ${VALOR_COORTE} ELSE 0 END), 0) AS valorAtraso
      FROM agendamentofinanceiro af
      ${lf.sql}
      ${WHERE_COORTE}
        ${empresaFilter.clause}
        ${periodo.clause}
      GROUP BY DATE_FORMAT(af.dataVencimento, '%Y-%m')
      ORDER BY mes
    `,
    params: [...lf.params, ...empresaFilter.params, ...periodo.params],
  };
}

export type PainelDetalheOrdem =
  | 'vencimento'
  | 'recebimento'
  | 'cliente'
  | 'empresa'
  | 'conta'
  | 'condicao'
  | 'valor'
  | 'atraso';

export function sqlOrdemDetalheNomus(
  ordem: PainelDetalheOrdem | undefined,
  dir: 'asc' | 'desc' | undefined,
  recuperado: boolean,
): string {
  const d = dir === 'asc' ? 'ASC' : 'DESC';
  switch (ordem) {
    case 'recebimento':
      return recuperado
        ? `COALESCE(lfRec.dataLanc, af.dataBaixa) ${d}, af.id ${d}`
        : `af.dataVencimento ${d}, af.id ${d}`;
    case 'cliente':
      return `pes.nome ${d}, af.id ${d}`;
    case 'empresa':
      return `e.nome ${d}, af.id ${d}`;
    case 'conta':
      return `af.id ${d}`;
    case 'condicao':
      return `IFNULL(fp.nome, '') ${d}, af.id ${d}`;
    case 'valor':
      return recuperado
        ? `ABS(IFNULL(af.valorBaixado, IFNULL(af.valorBaixar, 0))) ${d}, af.id ${d}`
        : `ABS(${VALOR_ABERTO_EFETIVO}) ${d}, af.id ${d}`;
    case 'atraso':
      return recuperado
        ? `DATEDIFF(${DATA_PAG}, DATE(af.dataVencimento)) ${d}, af.id ${d}`
        : `DATEDIFF(CURDATE(), af.dataVencimento) ${d}, af.id ${d}`;
    default:
      return `af.dataVencimento ${d}, af.id ${d}`;
  }
}

const WHERE_ABERTOS = `
WHERE af.discriminador IN ${RECEBER}
  AND ${TIPO_CONTA}
  AND ${AGENDAMENTO_ABERTO_EFETIVO}
  AND (
    (${AGENDAMENTO_PENDENTE} AND af.saldoBaixar > 0)
    OR (${AGENDAMENTO_BAIXADA} AND IFNULL(af.valorBaixar, 0) <> 0)
  )
  ${NF_NAO_CANCELADA}
  AND af.dataVencimento < CURDATE()
`;

const WHERE_RECUP = `
WHERE af.discriminador IN ${RECEBER}
  AND ${TIPO_CONTA}
  AND ${AGENDAMENTO_BAIXADA}
  AND IFNULL(af.cancelada, 0) = 0
  ${NF_NAO_CANCELADA}
  ${EXCLUIR_TITULO_DESCONTADO}
  AND af.dataVencimento IS NOT NULL
  AND COALESCE(lfRec.dataLanc, af.dataBaixa) IS NOT NULL
  AND ${sqlPagouAposPrazoEfetivoMysql('af.dataVencimento', 'COALESCE(lfRec.dataLanc, af.dataBaixa)')}
`;

function extraChaveEmpresaCondicao(opts: {
  chaveEmpresa?: string | null;
  chaveCondicao?: string | null;
}): { extra: string; params: QueryParams } {
  const extra: string[] = [];
  const params: QueryParams = [];
  if (opts.chaveEmpresa) {
    extra.push(opts.chaveEmpresa === 'Sem empresa' ? ' AND e.nome IS NULL ' : ' AND e.nome = ? ');
    if (opts.chaveEmpresa !== 'Sem empresa') params.push(opts.chaveEmpresa);
  }
  if (opts.chaveCondicao) {
    extra.push(
      opts.chaveCondicao === 'Sem forma' || opts.chaveCondicao === 'Sem condição'
        ? ' AND fp.nome IS NULL '
        : ' AND fp.nome = ? ',
    );
    if (opts.chaveCondicao !== 'Sem forma' && opts.chaveCondicao !== 'Sem condição') {
      params.push(opts.chaveCondicao);
    }
  }
  return { extra: extra.join(''), params };
}

export function buildPainelAtrasoEmpresaNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  const lf = joinLfPagamento(opts);
  return {
    sql: `
      SELECT
        IFNULL(e.nome, 'Sem empresa') AS chave,
        COUNT(*) AS qtd,
        COALESCE(SUM(${VALOR_COORTE}), 0) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      ${lf.sql}
      ${WHERE_COORTE}
        AND ${ATRASOU_PAGAMENTO}
        ${empresaFilter.clause}
        ${periodo.clause}
      GROUP BY e.nome
    `,
    params: [...lf.params, ...empresaFilter.params, ...periodo.params],
  };
}

export function buildPainelAtrasoCondicaoNomusQuery(opts?: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts?.vencimentoDe, opts?.vencimentoAte);
  const lf = joinLfPagamento(opts);
  return {
    sql: `
      SELECT
        IFNULL(fp.nome, 'Sem forma') AS chave,
        COUNT(*) AS qtd,
        COALESCE(SUM(${VALOR_COORTE}), 0) AS valor
      FROM agendamentofinanceiro af
      ${JOIN_FORMA}
      ${lf.sql}
      ${WHERE_COORTE}
        AND ${ATRASOU_PAGAMENTO}
        ${empresaFilter.clause}
        ${periodo.clause}
      GROUP BY fp.nome
    `,
    params: [...lf.params, ...empresaFilter.params, ...periodo.params],
  };
}

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
        COALESCE(SUM(ABS(${VALOR_ABERTO_EFETIVO})), 0) AS valor
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
        IFNULL(fp.nome, 'Sem forma') AS chave,
        COUNT(*) AS qtd,
        COALESCE(SUM(ABS(${VALOR_ABERTO_EFETIVO})), 0) AS valor
      FROM agendamentofinanceiro af
      ${JOIN_FORMA}
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
  ordem?: PainelDetalheOrdem;
  dir?: 'asc' | 'desc';
  countOnly?: boolean;
  limit: number;
  offset: number;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts.vencimentoDe, opts.vencimentoAte);
  const chave = extraChaveEmpresaCondicao(opts);
  const where = `
      ${WHERE_ABERTOS}
        ${empresaFilter.clause}
        ${periodo.clause}
        ${chave.extra}
  `;
  const baseParams = [...empresaFilter.params, ...periodo.params, ...chave.params];
  if (opts.countOnly) {
    return {
      sql: `SELECT COUNT(*) AS qtd, COALESCE(SUM(ABS(${VALOR_ABERTO_EFETIVO})), 0) AS valor FROM agendamentofinanceiro af LEFT JOIN empresa e ON e.id = af.idEmpresa ${JOIN_FORMA} ${where}`,
      params: baseParams,
    };
  }
  const order = sqlOrdemDetalheNomus(opts.ordem, opts.dir, false);
  return {
    sql: `
      SELECT
        af.id AS codigo,
        e.nome AS empresa,
        fp.nome AS formaPagamento,
        pes.nome AS pessoa,
        DATE(af.dataVencimento) AS dataVencimento,
        ABS(${VALOR_ABERTO_EFETIVO}) AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      ${JOIN_FORMA}
      LEFT JOIN pessoa pes ON pes.id = af.idPessoa
      ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `,
    params: [...baseParams, opts.limit, opts.offset],
  };
}

export function buildPainelRecuperadosDetalheNomusQuery(opts: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
  recebimentoDe?: string | null;
  recebimentoAte?: string | null;
  classe?: 'mesmo_mes' | 'outros_meses' | 'total';
  ordem?: PainelDetalheOrdem;
  dir?: 'asc' | 'desc';
  countOnly?: boolean;
  limit: number;
  offset: number;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts.vencimentoDe, opts.vencimentoAte);
  const rec = clausulaVencimento('COALESCE(lfRec.dataLanc, af.dataBaixa)', opts.recebimentoDe, opts.recebimentoAte);
  const lf = joinLfRecuperado(opts);
  let classeClause = '';
  if (opts.classe === 'mesmo_mes') classeClause = ` AND ${MESMO_MES} `;
  if (opts.classe === 'outros_meses') classeClause = ` AND NOT (${MESMO_MES}) `;
  const where = `
      ${WHERE_RECUP}
        ${empresaFilter.clause}
        ${periodo.clause}
        ${rec.clause}
        ${classeClause}
  `;
  const baseParams = [...lf.params, ...empresaFilter.params, ...periodo.params, ...rec.params];
  if (opts.countOnly) {
    return {
      sql: `SELECT COUNT(*) AS qtd, COALESCE(SUM(ABS(IFNULL(af.valorBaixado, IFNULL(af.valorBaixar, 0)))), 0) AS valor FROM agendamentofinanceiro af ${lf.sql} ${where}`,
      params: baseParams,
    };
  }
  const order = sqlOrdemDetalheNomus(opts.ordem, opts.dir, true);
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
      ${JOIN_FORMA}
      LEFT JOIN pessoa pes ON pes.id = af.idPessoa
      ${lf.sql}
      ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `,
    params: [...baseParams, opts.limit, opts.offset],
  };
}

export function buildPainelAtrasoLoteDetalheNomusQuery(opts: {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
  chaveEmpresa?: string | null;
  chaveCondicao?: string | null;
  apenasAtraso?: boolean;
  ordem?: PainelDetalheOrdem;
  dir?: 'asc' | 'desc';
  countOnly?: boolean;
  limit: number;
  offset: number;
}): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(null);
  const periodo = clausulaVencimento('af.dataVencimento', opts.vencimentoDe, opts.vencimentoAte);
  const lf = joinLfPagamento({ vencimentoDe: opts.vencimentoDe, vencimentoAte: opts.vencimentoAte });
  const chave = extraChaveEmpresaCondicao(opts);
  const atraso = opts.apenasAtraso === false ? '' : `AND ${ATRASOU_PAGAMENTO}`;
  const where = `
      ${WHERE_COORTE}
        ${atraso}
        ${empresaFilter.clause}
        ${periodo.clause}
        ${chave.extra}
  `;
  const baseParams = [...lf.params, ...empresaFilter.params, ...periodo.params, ...chave.params];
  if (opts.countOnly) {
    return {
      sql: `SELECT COUNT(*) AS qtd, COALESCE(SUM(${VALOR_COORTE}), 0) AS valor FROM agendamentofinanceiro af
        LEFT JOIN empresa e ON e.id = af.idEmpresa
        ${JOIN_FORMA}
        ${lf.sql} ${where}`,
      params: baseParams,
    };
  }
  const order = sqlOrdemDetalheNomus(opts.ordem, opts.dir, true);
  return {
    sql: `
      SELECT
        af.id AS codigo,
        e.nome AS empresa,
        fp.nome AS formaPagamento,
        pes.nome AS pessoa,
        DATE(af.dataVencimento) AS dataVencimento,
        DATE(af.dataBaixa) AS dataBaixa,
        CASE WHEN ${AINDA_INADIMPLENTE} THEN NULL ELSE ${DATA_PAG} END AS dataRecebimento,
        ${VALOR_COORTE} AS valor
      FROM agendamentofinanceiro af
      LEFT JOIN empresa e ON e.id = af.idEmpresa
      ${JOIN_FORMA}
      LEFT JOIN pessoa pes ON pes.id = af.idPessoa
      ${lf.sql}
      ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `,
    params: [...baseParams, opts.limit, opts.offset],
  };
}
