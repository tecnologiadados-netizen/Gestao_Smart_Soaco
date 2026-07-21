/** Base FROM/WHERE reutilizável — espelha a consulta.sql do projeto */
import { buildEmpresaFilter } from './empresaConfig.js';

type QueryParams = (string | number)[];

export const BASE_FROM = `
FROM agendamentofinanceiro af
LEFT JOIN pessoa pes ON pes.id = af.idPessoa
LEFT JOIN empresa e ON e.id = af.idEmpresa
LEFT JOIN contabancaria cb ON cb.id = af.idContaBancaria
LEFT JOIN contafinanceiro cf ON cf.id = af.idContaFinanceiro
LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
LEFT JOIN documentoestoque des ON des.id = af.idDocumentoSaida
LEFT JOIN documentoestoque dee ON dee.id = af.idDocumentoEntrada
`;

export const RECEBER_DISCRIMINADORES = "('R', 'CR', 'NCC')";
export const PAGAR_DISCRIMINADORES = "('P', 'CP', 'NCF')";

/** Weberp exibe Pendente quando baixada ≠ 1 (inclui NULL) */
export const AGENDAMENTO_PENDENTE = "IFNULL(af.baixada, 0) = 0";
export const AGENDAMENTO_BAIXADA = "af.baixada = 1";

/** Apenas Confirmada (1) e Adiantamento de cliente (3) — exclui Prevista e demais */
export const TIPO_CONTA_UTILIZADO = "af.tipoConta IN (1, 3)";

/** Status da NF-e/NFS-e de origem = Cancelada (NF-e status 7, NFS-e status 4). */
export const NF_ORIGEM_CANCELADA = `(
  COALESCE(nfes.status = 7, 0)
  OR COALESCE(nfee.status = 7, 0)
  OR COALESCE(nfse.status = 4, 0)
)`;
export const EXCLUIR_NF_ORIGEM_CANCELADA = ` AND NOT ${NF_ORIGEM_CANCELADA} `;

/** JOINs pré-agregados de lancamentofinanceiro — evita subconsultas correlacionadas por linha */
export const LF_AGREGADO_JOINS = `
LEFT JOIN (
  SELECT
    lf.idAgendamentoRecebimento AS idAf,
    SUM(lf.valor) AS valorRecebidoPago,
    MAX(lf.dataLancamento) AS dataRecebimento
  FROM lancamentofinanceiro lf
  WHERE lf.idAgendamentoRecebimento IS NOT NULL
  GROUP BY lf.idAgendamentoRecebimento
) lfRec ON lfRec.idAf = af.id
LEFT JOIN (
  SELECT
    lf.idAgendamentoPagamento AS idAf,
    SUM(lf.valor) AS valorRecebidoPago,
    MAX(lf.dataLancamento) AS dataRecebimento
  FROM lancamentofinanceiro lf
  WHERE lf.idAgendamentoPagamento IS NOT NULL
  GROUP BY lf.idAgendamentoPagamento
) lfPag ON lfPag.idAf = af.id
`;

/** Valor e data de recebimento/pagamento via JOIN (uso em agregações) */
export const LF_VALOR_RECEBIDO_PAGO =
  "COALESCE(lfRec.valorRecebidoPago, lfPag.valorRecebidoPago)";
export const VALOR_BAIXADO_AGENDAMENTO =
  `IF(af.discriminador IN ${RECEBER_DISCRIMINADORES}, af.valorBaixado, -(af.valorBaixado))`;

export const LF_DATA_REFERENCIA_RECEBIMENTO = `COALESCE(
  lfRec.dataRecebimento,
  lfPag.dataRecebimento,
  af.dataBaixa
)`;

export const LF_TEM_VALOR_RECEBIDO_PAGO = `COALESCE(${LF_VALOR_RECEBIDO_PAGO}, 0) > 0`;
export const TEM_RECEBIMENTO_OU_BAIXA = `(${LF_TEM_VALOR_RECEBIDO_PAGO} OR COALESCE(${VALOR_BAIXADO_AGENDAMENTO}, 0) > 0)`;

/** LF agregado restrito à pessoa/grupo/empresa — evita varrer toda lancamentofinanceiro. */
function buildLfAgregadoJoinsScoped(
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const grupoOk = grupoId != null && grupoId > 0;
  const useScope =
    !!pessoa?.trim() || grupoOk || (empresaId != null && empresaId > 0);

  if (!useScope) {
    return { sql: LF_AGREGADO_JOINS, params: [] };
  }

  const scopeClauses = [TIPO_CONTA_UTILIZADO.replace(/af\./g, "afScope.")];
  const params: QueryParams = [];
  const pessoaJoin =
    !!pessoa?.trim() || grupoOk
      ? "INNER JOIN pessoa pesScope ON pesScope.id = afScope.idPessoa"
      : "";

  if (grupoOk) {
    scopeClauses.push("pesScope.idGrupoPessoa = ?");
    params.push(grupoId!);
  } else if (pessoa?.trim()) {
    scopeClauses.push("pesScope.nome = ?");
    params.push(pessoa.trim());
  }
  if (empresaId != null && empresaId > 0) {
    scopeClauses.push("afScope.idEmpresa = ?");
    params.push(empresaId);
  }

  const scopeWhere = ` AND ${scopeClauses.join(" AND ")}`;
  const sql = `
LEFT JOIN (
  SELECT
    lf.idAgendamentoRecebimento AS idAf,
    SUM(lf.valor) AS valorRecebidoPago,
    MAX(lf.dataLancamento) AS dataRecebimento
  FROM lancamentofinanceiro lf
  INNER JOIN agendamentofinanceiro afScope ON afScope.id = lf.idAgendamentoRecebimento
  ${pessoaJoin}
  WHERE lf.idAgendamentoRecebimento IS NOT NULL${scopeWhere}
  GROUP BY lf.idAgendamentoRecebimento
) lfRec ON lfRec.idAf = af.id
LEFT JOIN (
  SELECT
    lf.idAgendamentoPagamento AS idAf,
    SUM(lf.valor) AS valorRecebidoPago,
    MAX(lf.dataLancamento) AS dataRecebimento
  FROM lancamentofinanceiro lf
  INNER JOIN agendamentofinanceiro afScope ON afScope.id = lf.idAgendamentoPagamento
  ${pessoaJoin}
  WHERE lf.idAgendamentoPagamento IS NOT NULL${scopeWhere}
  GROUP BY lf.idAgendamentoPagamento
) lfPag ON lfPag.idAf = af.id`;

  return { sql, params: mergeParams(params, params) };
}

/** FROM para agregações de indicadores (pendências + recebidos via lancamentofinanceiro). */
export function buildIndicadoresFrom(
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const precisaJoinPessoa =
    !!pessoa?.trim() || (grupoId != null && grupoId > 0);
  const lfJoins = buildLfAgregadoJoinsScoped(pessoa, empresaId, grupoId);

  return {
    sql: `
FROM agendamentofinanceiro af
LEFT JOIN contafinanceiro cf ON cf.id = af.idContaFinanceiro
LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
${precisaJoinPessoa ? "INNER JOIN pessoa pes ON pes.id = af.idPessoa" : ""}
${lfJoins.sql}`,
    params: lfJoins.params,
  };
}

/** Espelha a coluna "Valor recebido/pago" da consulta.sql */
export const VALOR_RECEBIDO_PAGO = `IFNULL(
  (SELECT SUM(lf.valor) FROM lancamentofinanceiro lf WHERE lf.idAgendamentoRecebimento = af.id),
  (SELECT SUM(lf.valor) FROM lancamentofinanceiro lf WHERE lf.idAgendamentoPagamento = af.id)
)`;

export const DATA_REFERENCIA_RECEBIMENTO = `COALESCE(
  (SELECT MAX(lf.dataLancamento) FROM lancamentofinanceiro lf WHERE lf.idAgendamentoRecebimento = af.id),
  (SELECT MAX(lf.dataLancamento) FROM lancamentofinanceiro lf WHERE lf.idAgendamentoPagamento = af.id),
  af.dataBaixa
)`;

export const TEM_VALOR_RECEBIDO_PAGO = `(${VALOR_RECEBIDO_PAGO}) IS NOT NULL AND (${VALOR_RECEBIDO_PAGO}) > 0`;

/** ID do lançamento financeiro vinculado (mais recente) — código exibido na tela Recebimentos do Weberp */
export const CODIGO_LANCAMENTO = `COALESCE(
  (SELECT lf.id FROM lancamentofinanceiro lf
    WHERE lf.idAgendamentoRecebimento = af.id
    ORDER BY lf.dataLancamento DESC, lf.id DESC LIMIT 1),
  (SELECT lf.id FROM lancamentofinanceiro lf
    WHERE lf.idAgendamentoPagamento = af.id
    ORDER BY lf.dataLancamento DESC, lf.id DESC LIMIT 1)
)`;

/** Comentários do lançamento financeiro vinculado (mais recente) */
export const COMENTARIOS_LANCAMENTO = `COALESCE(
  (SELECT lf.comentarios FROM lancamentofinanceiro lf
    WHERE lf.idAgendamentoRecebimento = af.id
    ORDER BY lf.dataLancamento DESC, lf.id DESC LIMIT 1),
  (SELECT lf.comentarios FROM lancamentofinanceiro lf
    WHERE lf.idAgendamentoPagamento = af.id
    ORDER BY lf.dataLancamento DESC, lf.id DESC LIMIT 1)
)`;

/** Comentário exclusivamente "TITULO DESCONTADO" — pagamento via FIDC, ainda não recebido do cliente. */
export const TITULO_DESCONTADO_COND = `(
  UPPER(TRIM(COALESCE(af.comentarios, ''))) = 'TITULO DESCONTADO'
  OR UPPER(TRIM(COALESCE(${COMENTARIOS_LANCAMENTO}, ''))) = 'TITULO DESCONTADO'
)`;

export const EXCLUIR_TITULO_DESCONTADO = ` AND NOT ${TITULO_DESCONTADO_COND} `;
const LF_RECEBIDO_VALIDO = `${TEM_RECEBIMENTO_OU_BAIXA} AND NOT ${TITULO_DESCONTADO_COND}`;
const AGENDAMENTO_ABERTO_EFETIVO = `(${AGENDAMENTO_PENDENTE} OR (${AGENDAMENTO_BAIXADA} AND ${TITULO_DESCONTADO_COND}))`;
const VALOR_ABERTO_EFETIVO = `CASE
  WHEN ${AGENDAMENTO_PENDENTE} THEN af.saldoBaixar
  WHEN ${AGENDAMENTO_BAIXADA} AND ${TITULO_DESCONTADO_COND} THEN af.valorBaixar
  ELSE 0
END`;
const INDICADOR_RECEBIDO_30D = `COALESCE(SUM(CASE WHEN ${LF_RECEBIDO_VALIDO} AND ${LF_DATA_REFERENCIA_RECEBIMENTO} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN ${LF_VALOR_RECEBIDO_PAGO} END), 0)`;
const INDICADOR_RECEBIDO_90D = `COALESCE(SUM(CASE WHEN ${LF_RECEBIDO_VALIDO} AND ${LF_DATA_REFERENCIA_RECEBIMENTO} >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN ${LF_VALOR_RECEBIDO_PAGO} END), 0)`;
const INDICADOR_RECEBIDO_ANO = `COALESCE(SUM(CASE WHEN ${LF_RECEBIDO_VALIDO} AND ${LF_DATA_REFERENCIA_RECEBIMENTO} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN ${LF_VALOR_RECEBIDO_PAGO} END), 0)`;
const INDICADOR_RECEBIDO_HISTORICO = `COALESCE(SUM(CASE WHEN ${LF_RECEBIDO_VALIDO} THEN ${LF_VALOR_RECEBIDO_PAGO} END), 0)`;

const SELECT_COLS_BODY = `
  IFNULL(dee.dataEmissao, des.dataEmissao) AS dataEmissao,
  af.dataVencimento AS dataVencimento,
  af.dataAgendamento AS dataAgendamento,
  af.dataBaixa AS dataBaixa,
  ${DATA_REFERENCIA_RECEBIMENTO} AS dataRecebimento,
  af.dataCompetencia AS dataCompetencia,
  cf.classificacao AS classificacao,
  cf.nome AS nomeClassificacao,
  e.nome AS empresa,
  cb.nome AS contaBancaria,
  fp.nome AS formaPagamento,
  pes.nome AS pessoa,
  af.descricaoLancamento AS descricao,
  af.comentarios AS comentariosAgendamento,
  ${COMENTARIOS_LANCAMENTO} AS comentariosLancamento,
  IFNULL(nfse.numero, IFNULL(nfee.numero, IFNULL(nfes.numero, dee.numeroNFS))) AS nfeOrigem,
  DATEDIFF(af.dataVencimento, ${DATA_REFERENCIA_RECEBIMENTO}) AS totalDias,
  IF(af.discriminador IN ('R', 'CR', 'NCC'), af.saldoBaixar, -(af.saldoBaixar)) AS valorSaldo,
  ${VALOR_RECEBIDO_PAGO} AS valorRecebidoPago,
  ${VALOR_BAIXADO_AGENDAMENTO} AS valorBaixado,
  IF(af.discriminador IN ('R', 'CR', 'NCC'), af.valorBaixar, -(af.valorBaixar)) AS valorOriginal,
  IF(af.baixada = 1, 'Baixada', 'Pendente') AS status,
  IF(af.discriminador = 'R', 'Entrada',
    IF(af.discriminador = 'P', 'Saída',
      IF(af.discriminador = 'CR', 'Cheques a receber',
        IF(af.discriminador = 'CP', 'Cheques a pagar', 'Outros')))) AS natureza,
  af.discriminador AS discriminador
`;

/** Código exibido nas tabelas — agendamentofinanceiro.id, igual às contas em aberto. */
export const SELECT_COLS = `
  af.id AS codigo,
  ${SELECT_COLS_BODY}
`;

/** Alias mantido para compatibilidade com buildBaixadosQuery */
export const SELECT_COLS_BAIXADOS = SELECT_COLS;

/**
 * Filtro por cliente individual (nome) ou grupo econômico Nomus (idGrupoPessoa).
 * Se `grupoId` for válido, tem prioridade sobre `pessoa`.
 */
export function buildPessoaFilter(
  pessoa?: string | null,
  grupoId?: number | null,
): {
  clause: string;
  params: QueryParams;
} {
  if (grupoId != null && grupoId > 0) {
    return {
      clause: " AND pes.idGrupoPessoa = ? ",
      params: [grupoId],
    };
  }
  if (!pessoa?.trim()) {
    return { clause: "", params: [] };
  }
  return {
    clause: " AND pes.nome = ? ",
    params: [pessoa.trim()],
  };
}

function mergeParams(
  ...groups: Array<string | number>[]
): (string | number)[] {
  return groups.flat();
}

export function buildIndicadoresQuery(
  tipo: "receber" | "pagar",
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const empresaFilter = buildEmpresaFilter(empresaId);
  const from = buildIndicadoresFrom(pessoa, empresaId, grupoId);

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS total,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND af.dataVencimento < CURDATE() THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emAtraso,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND (af.dataVencimento >= CURDATE() OR af.dataVencimento IS NULL) THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emDia,
      ${INDICADOR_RECEBIDO_30D} AS recebido30d,
      ${INDICADOR_RECEBIDO_90D} AS recebido90d,
      ${INDICADOR_RECEBIDO_ANO} AS recebidoAno,
      ${INDICADOR_RECEBIDO_HISTORICO} AS recebidoHistorico
    ${from.sql}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
  `;

  return {
    sql,
    params: mergeParams(from.params, pessoaFilter.params, empresaFilter.params),
  };
}

export function buildIndicadoresClassificacaoQuery(
  tipo: "receber" | "pagar",
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const empresaFilter = buildEmpresaFilter(empresaId);
  const from = buildIndicadoresFrom(pessoa, empresaId, grupoId);

  const sql = `
    SELECT
      COALESCE(cf.classificacao, 'Sem classificação') AS classificacao,
      COALESCE(MAX(cf.nome), 'Sem nome') AS nomeClassificacao,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS total,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND af.dataVencimento < CURDATE() THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emAtraso,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND (af.dataVencimento >= CURDATE() OR af.dataVencimento IS NULL) THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emDia,
      ${INDICADOR_RECEBIDO_30D} AS recebido30d,
      ${INDICADOR_RECEBIDO_90D} AS recebido90d,
      ${INDICADOR_RECEBIDO_ANO} AS recebidoAno,
      ${INDICADOR_RECEBIDO_HISTORICO} AS recebidoHistorico
    ${from.sql}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    GROUP BY cf.classificacao
    HAVING total > 0 OR recebidoHistorico > 0
    ORDER BY total DESC, recebidoHistorico DESC
  `;

  return {
    sql,
    params: mergeParams(from.params, pessoaFilter.params, empresaFilter.params),
  };
}

/** Consulta única: indicadores por tipo e classificação (substitui 4 queries separadas) */
export function buildIndicadoresConsolidadoQuery(
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): {
  sql: string;
  params: QueryParams;
} {
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const empresaFilter = buildEmpresaFilter(empresaId);
  const from = buildIndicadoresFrom(pessoa, empresaId, grupoId);

  const sql = `
    SELECT
      IF(af.discriminador IN ${RECEBER_DISCRIMINADORES}, 'receber', 'pagar') AS tipo,
      COALESCE(cf.classificacao, 'Sem classificação') AS classificacao,
      COALESCE(MAX(cf.nome), 'Sem nome') AS nomeClassificacao,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS total,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND af.dataVencimento < CURDATE() THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emAtraso,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_ABERTO_EFETIVO} AND (af.dataVencimento >= CURDATE() OR af.dataVencimento IS NULL) THEN ${VALOR_ABERTO_EFETIVO} END), 0) AS emDia,
      ${INDICADOR_RECEBIDO_30D} AS recebido30d,
      ${INDICADOR_RECEBIDO_90D} AS recebido90d,
      ${INDICADOR_RECEBIDO_ANO} AS recebidoAno,
      ${INDICADOR_RECEBIDO_HISTORICO} AS recebidoHistorico
    ${from.sql}
    WHERE (af.discriminador IN ${RECEBER_DISCRIMINADORES} OR af.discriminador IN ${PAGAR_DISCRIMINADORES})
      AND ${TIPO_CONTA_UTILIZADO}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    GROUP BY tipo, cf.classificacao
    HAVING total > 0 OR recebidoHistorico > 0
    ORDER BY tipo, total DESC, recebidoHistorico DESC
  `;

  return {
    sql,
    params: mergeParams(from.params, pessoaFilter.params, empresaFilter.params),
  };
}

export function buildClassificacaoFilter(classificacao?: string | null): {
  clause: string;
  params: QueryParams;
} {
  if (classificacao == null) {
    return { clause: "", params: [] };
  }
  return {
    clause: " AND COALESCE(cf.classificacao, 'Sem classificação') = ? ",
    params: [classificacao],
  };
}

/** FROM enxuto para listagem de contas pendentes (sem subconsultas correlacionadas). */
const BASE_FROM_CONTAS_DETALHE = `
FROM agendamentofinanceiro af
LEFT JOIN pessoa pes ON pes.id = af.idPessoa
LEFT JOIN empresa e ON e.id = af.idEmpresa
LEFT JOIN contabancaria cb ON cb.id = af.idContaBancaria
LEFT JOIN contafinanceiro cf ON cf.id = af.idContaFinanceiro
LEFT JOIN formapagamento fp ON fp.id = af.idFormaPagamento
LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
LEFT JOIN documentoestoque dee ON dee.id = af.idDocumentoEntrada
`;

const SELECT_COLS_CONTAS_DETALHE = `
  af.id AS codigo,
  af.dataVencimento AS dataVencimento,
  af.dataAgendamento AS dataAgendamento,
  cf.classificacao AS classificacao,
  cf.nome AS nomeClassificacao,
  e.nome AS empresa,
  cb.nome AS contaBancaria,
  fp.nome AS formaPagamento,
  pes.nome AS pessoa,
  af.descricaoLancamento AS descricao,
  af.comentarios AS comentariosAgendamento,
  ${COMENTARIOS_LANCAMENTO} AS comentariosLancamento,
  IFNULL(nfse.numero, IFNULL(nfee.numero, IFNULL(nfes.numero, dee.numeroNFS))) AS nfeOrigem,
  IF(af.discriminador IN ('R', 'CR', 'NCC'), af.saldoBaixar, -(af.saldoBaixar)) AS valorSaldo,
  IF(af.baixada = 1, 'Baixada', 'Pendente') AS status,
  IF(af.discriminador = 'R', 'Entrada',
    IF(af.discriminador = 'P', 'Saída',
      IF(af.discriminador = 'CR', 'Cheques a receber',
        IF(af.discriminador = 'CP', 'Cheques a pagar', 'Outros')))) AS natureza,
  0 AS tituloDescontadoAberto
`;

export function buildContasQuery(
  tipo: "receber" | "pagar",
  situacao: "total" | "atraso" | "emDia",
  pessoa?: string | null,
  classificacao?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const classificacaoFilter = buildClassificacaoFilter(classificacao);
  const empresaFilter = buildEmpresaFilter(empresaId);

  const situacaoClause =
    situacao === "total"
      ? ` AND ${AGENDAMENTO_PENDENTE} `
      : situacao === "atraso"
        ? ` AND ${AGENDAMENTO_PENDENTE} AND af.dataVencimento < CURDATE() `
        : ` AND ${AGENDAMENTO_PENDENTE} AND (af.dataVencimento >= CURDATE() OR af.dataVencimento IS NULL) `;

  const sql = `
    SELECT
      ${SELECT_COLS_CONTAS_DETALHE},
      DATEDIFF(CURDATE(), af.dataVencimento) AS diasAtraso
    ${BASE_FROM_CONTAS_DETALHE}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      AND af.saldoBaixar > 0
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${situacaoClause}
      ${classificacaoFilter.clause}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    ORDER BY af.dataVencimento ASC, af.id ASC
  `;

  return {
    sql,
    params: mergeParams(
      classificacaoFilter.params,
      pessoaFilter.params,
      empresaFilter.params,
    ),
  };
}

/** Baixados com comentário TITULO DESCONTADO — tratados como contas em aberto (FIDC). */
export function buildTitulosDescontadoContasQuery(
  tipo: "receber" | "pagar",
  pessoa?: string | null,
  classificacao?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const classificacaoFilter = buildClassificacaoFilter(classificacao);
  const empresaFilter = buildEmpresaFilter(empresaId);

  const sql = `
    SELECT
      af.id AS codigo,
      af.dataVencimento AS dataVencimento,
      af.dataAgendamento AS dataAgendamento,
      cf.classificacao AS classificacao,
      cf.nome AS nomeClassificacao,
      e.nome AS empresa,
      cb.nome AS contaBancaria,
      fp.nome AS formaPagamento,
      pes.nome AS pessoa,
      af.descricaoLancamento AS descricao,
      af.comentarios AS comentariosAgendamento,
      ${COMENTARIOS_LANCAMENTO} AS comentariosLancamento,
      IFNULL(nfse.numero, IFNULL(nfee.numero, IFNULL(nfes.numero, dee.numeroNFS))) AS nfeOrigem,
      IF(af.discriminador IN ('R', 'CR', 'NCC'), af.valorBaixar, -(af.valorBaixar)) AS valorSaldo,
      'Pendente' AS status,
      IF(af.discriminador = 'R', 'Entrada',
        IF(af.discriminador = 'P', 'Saída',
          IF(af.discriminador = 'CR', 'Cheques a receber',
            IF(af.discriminador = 'CP', 'Cheques a pagar', 'Outros')))) AS natureza,
      1 AS tituloDescontadoAberto,
      DATEDIFF(CURDATE(), af.dataVencimento) AS diasAtraso
    ${BASE_FROM_CONTAS_DETALHE}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      AND ${AGENDAMENTO_BAIXADA}
      AND ${TITULO_DESCONTADO_COND}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${classificacaoFilter.clause}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    ORDER BY af.dataVencimento ASC, af.id ASC
  `;

  return {
    sql,
    params: mergeParams(
      classificacaoFilter.params,
      pessoaFilter.params,
      empresaFilter.params,
    ),
  };
}

export type PeriodoRecebido = "30d" | "90d" | "ano" | "historico";

export function buildRecebimentosDetalheQuery(
  tipo: "receber" | "pagar",
  periodo: PeriodoRecebido,
  pessoa?: string | null,
  classificacao?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const classificacaoFilter = buildClassificacaoFilter(classificacao);
  const empresaFilter = buildEmpresaFilter(empresaId);
  const dataRef = LF_DATA_REFERENCIA_RECEBIMENTO;

  const periodoClause =
    periodo === "historico"
      ? ""
      : periodo === "30d"
        ? ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) `
        : periodo === "90d"
          ? ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) `
          : ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) `;

  const sql = `
    SELECT
      ${SELECT_COLS},
      DATEDIFF(CURDATE(), af.dataVencimento) AS diasAtraso
    ${BASE_FROM}
    ${LF_AGREGADO_JOINS}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      AND ${TEM_RECEBIMENTO_OU_BAIXA}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${EXCLUIR_TITULO_DESCONTADO}
      ${periodoClause}
      ${classificacaoFilter.clause}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    ORDER BY ${dataRef} DESC, af.id DESC
  `;

  return {
    sql,
    params: mergeParams(
      classificacaoFilter.params,
      pessoaFilter.params,
      empresaFilter.params,
    ),
  };
}

export function buildRecebimentosDetalheResumoQuery(
  tipo: "receber" | "pagar",
  periodo: PeriodoRecebido,
  pessoa?: string | null,
  classificacao?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const classificacaoFilter = buildClassificacaoFilter(classificacao);
  const empresaFilter = buildEmpresaFilter(empresaId);
  const dataRef = LF_DATA_REFERENCIA_RECEBIMENTO;

  const periodoClause =
    periodo === "historico"
      ? ""
      : periodo === "30d"
        ? ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) `
        : periodo === "90d"
          ? ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) `
          : ` AND ${dataRef} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) `;

  const sql = `
    SELECT
      COUNT(*) AS quantidadeTotal,
      COALESCE(SUM(${LF_VALOR_RECEBIDO_PAGO}), 0) AS valorTotal
    ${BASE_FROM}
    ${LF_AGREGADO_JOINS}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      AND ${TEM_RECEBIMENTO_OU_BAIXA}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${EXCLUIR_TITULO_DESCONTADO}
      ${periodoClause}
      ${classificacaoFilter.clause}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
  `;

  return {
    sql,
    params: mergeParams(
      classificacaoFilter.params,
      pessoaFilter.params,
      empresaFilter.params,
    ),
  };
}

/** Recebimentos enxutos para cálculo de saúde da empresa (join direto, sem agregação global). */
export function buildBaixadosSaudeEmpresaQuery(
  empresaId?: number | null,
): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(empresaId);
  const dataRecebimento = `COALESCE(MAX(lfRec.dataLancamento), af.dataBaixa)`;
  const valorRecebido = `COALESCE(SUM(lfRec.valor), af.valorBaixado)`;

  const sql = `
    SELECT
      af.id AS codigo,
      af.dataVencimento AS dataVencimento,
      af.dataBaixa AS dataBaixa,
      ${dataRecebimento} AS dataRecebimento,
      DATEDIFF(af.dataVencimento, ${dataRecebimento}) AS totalDias,
      af.valorBaixar AS valorOriginal,
      ${valorRecebido} AS valorRecebidoPago
    FROM agendamentofinanceiro af
    LEFT JOIN lancamentofinanceiro lfRec
      ON lfRec.idAgendamentoRecebimento = af.id
    LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
    LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
    LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
    WHERE af.discriminador IN ${RECEBER_DISCRIMINADORES}
      AND ${TIPO_CONTA_UTILIZADO}
      AND ${AGENDAMENTO_BAIXADA}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${empresaFilter.clause}
    GROUP BY
      af.id,
      af.dataVencimento,
      af.dataBaixa,
      af.valorBaixar,
      af.valorBaixado
    HAVING ${valorRecebido} > 0
  `;

  return { sql, params: empresaFilter.params };
}

/** Resumo agrupado para saúde da empresa — evita trafegar todos os recebimentos históricos. */
export function buildResumoBaixadosSaudeEmpresaQuery(
  empresaId?: number | null,
): { sql: string; params: QueryParams } {
  const empresaFilter = buildEmpresaFilter(empresaId);
  const dataRecebimento = `COALESCE(MAX(lfRec.dataLancamento), af.dataBaixa)`;
  const valorRecebido = `COALESCE(SUM(lfRec.valor), af.valorBaixado)`;

  const sql = `
    SELECT
      base.dataVencimento,
      base.dataBaixa,
      base.dataRecebimento,
      DATEDIFF(base.dataVencimento, base.dataRecebimento) AS totalDias,
      IF(base.valorRecebidoPago > base.valorOriginal, 1, 0) AS temJuros,
      COUNT(*) AS quantidade
    FROM (
      SELECT
        af.id,
        af.dataVencimento AS dataVencimento,
        af.dataBaixa AS dataBaixa,
        ${dataRecebimento} AS dataRecebimento,
        af.valorBaixar AS valorOriginal,
        ${valorRecebido} AS valorRecebidoPago
      FROM agendamentofinanceiro af
      LEFT JOIN lancamentofinanceiro lfRec
        ON lfRec.idAgendamentoRecebimento = af.id
      LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
      LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
      LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
      WHERE af.discriminador IN ${RECEBER_DISCRIMINADORES}
        AND ${TIPO_CONTA_UTILIZADO}
        AND ${AGENDAMENTO_BAIXADA}
        ${EXCLUIR_NF_ORIGEM_CANCELADA}
        ${empresaFilter.clause}
      GROUP BY
        af.id,
        af.dataVencimento,
        af.dataBaixa,
        af.valorBaixar,
        af.valorBaixado
      HAVING valorRecebidoPago > 0
    ) base
    GROUP BY
      base.dataVencimento,
      base.dataBaixa,
      base.dataRecebimento,
      totalDias,
      temJuros
  `;

  return { sql, params: empresaFilter.params };
}

export function buildBaixadosQuery(
  tipo: "receber" | "pagar",
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): { sql: string; params: QueryParams } {
  const discriminadores =
    tipo === "receber" ? RECEBER_DISCRIMINADORES : PAGAR_DISCRIMINADORES;
  const pessoaFilter = buildPessoaFilter(pessoa, grupoId);
  const empresaFilter = buildEmpresaFilter(empresaId);

  const sql = `
    SELECT
      ${SELECT_COLS_BAIXADOS}
    ${BASE_FROM}
    WHERE af.discriminador IN ${discriminadores}
      AND ${TIPO_CONTA_UTILIZADO}
      AND ${AGENDAMENTO_BAIXADA}
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${EXCLUIR_TITULO_DESCONTADO}
      ${pessoaFilter.clause}
      ${empresaFilter.clause}
    ORDER BY ${DATA_REFERENCIA_RECEBIMENTO} ASC, ${CODIGO_LANCAMENTO} ASC, af.id ASC
  `;

  return {
    sql,
    params: mergeParams(pessoaFilter.params, empresaFilter.params),
  };
}

export function buildPessoasQuery(
  search?: string | null,
  empresaId?: number | null,
): {
  sql: string;
  params: QueryParams;
} {
  const empresaFilter = buildEmpresaFilter(empresaId);
  const params: QueryParams = [...empresaFilter.params];
  let searchClause = "";

  if (search?.trim()) {
    searchClause =
      " AND (pes.nome LIKE ? OR pes.nomeRazaoSocial LIKE ? OR pes.cnpjCpf LIKE ? OR pes.cpf LIKE ? OR IFNULL(gp.grupo, '') LIKE ?) ";
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  const sql = `
    SELECT
      pes.nome AS nome,
      pes.nomeRazaoSocial AS razaoSocial,
      IF(pes.tipoPessoa = 1, pes.cnpjCpf, pes.cpf) AS cnpjCpf,
      pes.idGrupoPessoa AS idGrupoPessoa,
      IFNULL(gp.grupo, '') AS grupo,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_PENDENTE} AND af.discriminador IN ('R','CR','NCC') THEN af.saldoBaixar ELSE 0 END), 0) AS totalPendente
    FROM pessoa pes
    LEFT JOIN grupopessoa gp ON gp.id = pes.idGrupoPessoa
    INNER JOIN agendamentofinanceiro af ON af.idPessoa = pes.id AND ${TIPO_CONTA_UTILIZADO}${empresaFilter.clause}
    LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
    LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
    LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
    WHERE pes.ativo = 1
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${searchClause}
    GROUP BY pes.id, pes.nome, pes.nomeRazaoSocial, pes.cnpjCpf, pes.cpf, pes.tipoPessoa, pes.idGrupoPessoa, gp.grupo
    HAVING totalPendente > 0 OR COUNT(af.id) > 0
    ORDER BY pes.nome ASC
    LIMIT 100
  `;

  return { sql, params };
}

/** Grupos econômicos Nomus que batem na busca (nome do grupo ou de algum membro). */
export function buildGruposPessoaQuery(
  search?: string | null,
  empresaId?: number | null,
): {
  sql: string;
  params: QueryParams;
} {
  const empresaFilter = buildEmpresaFilter(empresaId);
  const params: QueryParams = [...empresaFilter.params];
  let searchClause = "";

  if (search?.trim()) {
    searchClause = `
      AND (
        IFNULL(gp.grupo, '') LIKE ?
        OR EXISTS (
          SELECT 1 FROM pessoa p2
          WHERE p2.idGrupoPessoa = gp.id
            AND p2.ativo = 1
            AND (
              p2.nome LIKE ?
              OR p2.nomeRazaoSocial LIKE ?
              OR p2.cnpjCpf LIKE ?
              OR p2.cpf LIKE ?
            )
        )
      ) `;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  const sql = `
    SELECT
      gp.id AS id,
      IFNULL(gp.grupo, '') AS nome,
      COUNT(DISTINCT pes.id) AS qtdMembros,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_PENDENTE} AND af.discriminador IN ('R','CR','NCC') THEN af.saldoBaixar ELSE 0 END), 0) AS totalPendente
    FROM grupopessoa gp
    INNER JOIN pessoa pes ON pes.idGrupoPessoa = gp.id AND pes.ativo = 1
    INNER JOIN agendamentofinanceiro af ON af.idPessoa = pes.id AND ${TIPO_CONTA_UTILIZADO}${empresaFilter.clause}
    LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
    LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
    LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
    WHERE IFNULL(gp.grupo, '') <> ''
      ${EXCLUIR_NF_ORIGEM_CANCELADA}
      ${searchClause}
    GROUP BY gp.id, gp.grupo
    HAVING qtdMembros > 0 AND (totalPendente > 0 OR COUNT(af.id) > 0)
    ORDER BY gp.grupo ASC
    LIMIT 30
  `;

  return { sql, params };
}

/** Membros ativos de um grupo com pendência consolidada (visão de detalhe). */
export function buildMembrosGrupoQuery(
  grupoId: number,
  empresaId?: number | null,
): {
  sql: string;
  params: QueryParams;
} {
  const empresaFilter = buildEmpresaFilter(empresaId);
  const params: QueryParams = [...empresaFilter.params, grupoId];

  const sql = `
    SELECT
      pes.nome AS nome,
      pes.nomeRazaoSocial AS razaoSocial,
      IF(pes.tipoPessoa = 1, pes.cnpjCpf, pes.cpf) AS cnpjCpf,
      COALESCE(SUM(CASE WHEN ${AGENDAMENTO_PENDENTE} AND af.discriminador IN ('R','CR','NCC') THEN af.saldoBaixar ELSE 0 END), 0) AS totalPendente
    FROM pessoa pes
    LEFT JOIN agendamentofinanceiro af ON af.idPessoa = pes.id AND ${TIPO_CONTA_UTILIZADO}${empresaFilter.clause}
    LEFT JOIN nfe nfes ON nfes.idDocumentoEstoque = af.idDocumentoSaida
    LEFT JOIN nfe nfee ON nfee.idDocumentoEstoque = af.idDocumentoEntrada
    LEFT JOIN nfse ON nfse.idDocumentoServico = af.idDocumentoSaida
    WHERE pes.ativo = 1
      AND pes.idGrupoPessoa = ?
      AND (af.id IS NULL OR NOT ${NF_ORIGEM_CANCELADA})
    GROUP BY pes.id, pes.nome, pes.nomeRazaoSocial, pes.cnpjCpf, pes.cpf, pes.tipoPessoa
    ORDER BY totalPendente DESC, pes.nome ASC
  `;

  return { sql, params };
}

export function buildEmpresasQuery(): { sql: string; params: QueryParams } {
  return {
    sql: `
      SELECT id, nome
      FROM empresa
      ORDER BY nome ASC
    `,
    params: [],
  };
}
