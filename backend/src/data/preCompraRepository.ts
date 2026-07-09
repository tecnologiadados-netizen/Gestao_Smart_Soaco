/**
 * Consultas Nomus para Pré Compra — cotações em Decisão de compra / Encerrada e emissão PDF.
 */

import type { RowDataPacket } from 'mysql2/promise';
import { getNomusPool } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export const STATUS_LABELS: Record<number, string> = {
  1: 'Preparação',
  2: 'Coleta de preços',
  3: 'Decisão de compra',
  4: 'Encerrada',
};

const BASE_JOINS = `
FROM cotacaocompra c
LEFT JOIN pessoa p ON c.idComprador = p.id
LEFT JOIN (
    SELECT t.*, ROW_NUMBER() OVER (
        PARTITION BY t.idEntidade ORDER BY t.telefonePrincipal DESC, t.id
    ) AS rn
    FROM telefone t WHERE t.discriminador = 'P'
) t ON p.id = t.idEntidade AND t.rn = 1
LEFT JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
LEFT JOIN pessoa pcole ON cc.idFornecedor = pcole.id
LEFT JOIN (
    SELECT tcole.*, ROW_NUMBER() OVER (
        PARTITION BY tcole.idEntidade ORDER BY tcole.telefonePrincipal DESC, tcole.id
    ) AS rn
    FROM telefone tcole WHERE tcole.discriminador = 'P'
) tcole ON pcole.id = tcole.idEntidade AND tcole.rn = 1
LEFT JOIN municipio m ON pcole.idMunicipio = m.id
LEFT JOIN itemcoletaprecoscotacao icpc ON icpc.idColetaPrecosCotacao = cc.id
LEFT JOIN unidademedida u ON icpc.idUnidadeMedida = u.id
LEFT JOIN itemcotacaocompra icc ON icc.id = icpc.idItemCotacaoCompra
LEFT JOIN produto prod ON prod.id = icc.idProduto
LEFT JOIN codigoprodutoexterno cpe
    ON cpe.idProduto = icc.idProduto
   AND cpe.idPessoa = pcole.id
   AND cpe.idUnidadeMedida = icpc.idUnidadeMedida
LEFT JOIN solicitacaocompra_itemcotacaocompra sicc ON sicc.idItemCotacaoCompra = icc.id
LEFT JOIN solicitacaocompra sc ON sc.id = sicc.idSolicitacaoCompra
WHERE c.status IN (3, 4)
`;

const LIST_SELECT = `
SELECT
    c.nome AS cotacao,
    c.dataEmissao AS data_emissao,
    p.nome AS comprador,
    p.email AS email,
    CONCAT(IF(t.DDD IS NULL, '', CONCAT('(', t.DDD, ') ')), t.numero) AS telefone,
    pcole.id AS fornecedor_id,
    pcole.nome AS fornecedor,
    pcole.cnpjCpf AS cnpj,
    CONCAT(IF(tcole.DDD IS NULL, '', CONCAT('(', tcole.DDD, ') ')), tcole.numero) AS telefone_fornecedor,
    pcole.cep,
    pcole.endereco,
    pcole.numero AS numero_endereco,
    pcole.bairroDistrito AS bairro,
    m.nome AS municipio,
    prod.nome AS codigo_produto,
    cpe.codigo AS codigo_fornecedor,
    prod.descricao AS descricao_produto,
    icc.qtde AS qtde,
    u.abreviatura AS unidade,
    icpc.precoUnitario AS preco_unitario,
    icpc.valorTotalComDesconto AS valor_total,
    sc.id AS solicitacao_id,
    sc.dataNecessidade AS data_necessidade,
    c.status AS status
`;

const LIST_QUERY = LIST_SELECT + BASE_JOINS;

const PDF_SELECT = `
SELECT
    c.nome AS cotacao,
    c.dataEmissao AS data_emissao,
    p.nome AS comprador,
    p.email AS email,
    CONCAT(IF(t.DDD IS NULL, '', CONCAT('(', t.DDD, ') ')), t.numero) AS telefone,
    pcole.id AS fornecedor_id,
    pcole.nome AS fornecedor,
    pcole.cnpjCpf AS cnpj,
    CONCAT(IF(tcole.DDD IS NULL, '', CONCAT('(', tcole.DDD, ') ')), tcole.numero) AS telefone_fornecedor,
    cont.id AS contato_id,
    cont.nome AS contato,
    pcole.cep,
    pcole.endereco,
    pcole.numero AS numero_endereco,
    pcole.bairroDistrito AS bairro,
    m.nome AS municipio,
    prod.nome AS codigo_produto,
    cpe.codigo AS codigo_fornecedor,
    prod.descricao AS descricao_produto,
    icc.qtde AS qtde,
    u.abreviatura AS unidade,
    icpc.precoUnitario AS preco_unitario,
    icpc.valorTotalComDesconto AS valor_total,
    sc.id AS solicitacao_id,
    sc.dataNecessidade AS data_necessidade,
    c.status AS status
`;

const PDF_JOINS = `
FROM cotacaocompra c
LEFT JOIN pessoa p ON c.idComprador = p.id
LEFT JOIN (
    SELECT t.*, ROW_NUMBER() OVER (
        PARTITION BY t.idEntidade ORDER BY t.telefonePrincipal DESC, t.id
    ) AS rn
    FROM telefone t WHERE t.discriminador = 'P'
) t ON p.id = t.idEntidade AND t.rn = 1
LEFT JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
LEFT JOIN pessoa pcole ON cc.idFornecedor = pcole.id
LEFT JOIN (
    SELECT tcole.*, ROW_NUMBER() OVER (
        PARTITION BY tcole.idEntidade ORDER BY tcole.telefonePrincipal DESC, tcole.id
    ) AS rn
    FROM telefone tcole WHERE tcole.discriminador = 'P'
) tcole ON pcole.id = tcole.idEntidade AND tcole.rn = 1
LEFT JOIN pessoa_contato pcont ON pcont.idParceiro = pcole.id
LEFT JOIN contato cont ON cont.id = pcont.idContato
LEFT JOIN municipio m ON pcole.idMunicipio = m.id
LEFT JOIN itemcoletaprecoscotacao icpc ON icpc.idColetaPrecosCotacao = cc.id
LEFT JOIN unidademedida u ON icpc.idUnidadeMedida = u.id
LEFT JOIN itemcotacaocompra icc ON icc.id = icpc.idItemCotacaoCompra
LEFT JOIN produto prod ON prod.id = icc.idProduto
LEFT JOIN codigoprodutoexterno cpe
    ON cpe.idProduto = icc.idProduto
   AND cpe.idPessoa = pcole.id
   AND cpe.idUnidadeMedida = icpc.idUnidadeMedida
LEFT JOIN solicitacaocompra_itemcotacaocompra sicc ON sicc.idItemCotacaoCompra = icc.id
LEFT JOIN solicitacaocompra sc ON sc.id = sicc.idSolicitacaoCompra
WHERE c.status IN (3, 4)
`;

const PDF_QUERY = PDF_SELECT + PDF_JOINS;

const FORNECEDORES_QUERY = `
SELECT DISTINCT pcole.id AS id, pcole.nome AS nome, pcole.cnpjCpf AS cnpj
FROM cotacaocompra c
JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
JOIN pessoa pcole ON cc.idFornecedor = pcole.id
WHERE c.nome = ? AND c.status IN (3, 4)
ORDER BY pcole.nome
`;

const CONTATOS_QUERY = `
SELECT DISTINCT cont.id AS id, cont.nome AS nome
FROM cotacaocompra c
JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
JOIN pessoa pcole ON cc.idFornecedor = pcole.id
JOIN pessoa_contato pcont ON pcont.idParceiro = pcole.id
JOIN contato cont ON cont.id = pcont.idContato
WHERE c.nome = ? AND pcole.id = ? AND c.status IN (3, 4)
ORDER BY cont.nome
`;

const SUGGEST_QUERIES: Record<string, string> = {
  cotacao: `
SELECT DISTINCT c.nome AS valor, NULL AS subvalor
FROM cotacaocompra c
WHERE c.status IN (3, 4) AND c.nome LIKE ?
ORDER BY c.nome DESC
LIMIT ?
`,
  fornecedor: `
SELECT DISTINCT pcole.nome AS valor, NULL AS subvalor
FROM cotacaocompra c
JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
JOIN pessoa pcole ON cc.idFornecedor = pcole.id
WHERE c.status IN (3, 4) AND pcole.nome LIKE ?
ORDER BY pcole.nome
LIMIT ?
`,
  comprador: `
SELECT DISTINCT p.nome AS valor, NULL AS subvalor
FROM cotacaocompra c
JOIN pessoa p ON c.idComprador = p.id
WHERE c.status IN (3, 4) AND p.nome LIKE ?
ORDER BY p.nome
LIMIT ?
`,
  produto: `
SELECT DISTINCT prod.nome AS valor, prod.descricao AS subvalor
FROM cotacaocompra c
JOIN coletaprecoscotacao cc ON c.id = cc.idCotacaoCompra
JOIN itemcoletaprecoscotacao icpc ON icpc.idColetaPrecosCotacao = cc.id
JOIN itemcotacaocompra icc ON icc.id = icpc.idItemCotacaoCompra
JOIN produto prod ON prod.id = icc.idProduto
WHERE c.status IN (3, 4)
  AND (prod.nome LIKE ? OR prod.descricao LIKE ?)
ORDER BY prod.nome
LIMIT ?
`,
};

export type CampoSugestaoPreCompra = 'cotacao' | 'fornecedor' | 'comprador' | 'produto';

export interface FiltrosPreCompraCotacoes {
  cotacao?: string;
  fornecedor?: string;
  produto?: string;
  comprador?: string;
  status?: number;
  dataInicio?: string;
  dataFim?: string;
}

export interface PreCompraCotacaoRow {
  cotacao: string;
  data_emissao: Date | string | null;
  comprador: string | null;
  email: string | null;
  telefone: string | null;
  fornecedor_id: number | null;
  fornecedor: string | null;
  cnpj: string | null;
  telefone_fornecedor: string | null;
  cep: string | null;
  endereco: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  codigo_produto: string | null;
  codigo_fornecedor: string | null;
  descricao_produto: string | null;
  qtde: number | null;
  unidade: string | null;
  preco_unitario: number | null;
  valor_total: number | null;
  solicitacao_id: number | null;
  data_necessidade: Date | string | null;
  status: number | null;
  contato_id?: number | null;
  contato?: string | null;
}

export interface PreCompraFornecedorRow {
  id: number;
  nome: string;
  cnpj: string | null;
}

export interface PreCompraContatoRow {
  id: number;
  nome: string;
}

export interface PreCompraSugestaoRow {
  valor: string;
  subvalor: string | null;
}

function buildFilterSql(filtros: FiltrosPreCompraCotacoes): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.cotacao?.trim()) {
    conditions.push('c.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.cotacao));
  }
  if (filtros.fornecedor?.trim()) {
    conditions.push('pcole.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.fornecedor));
  }
  if (filtros.produto?.trim()) {
    const like = termoParaPadraoLikeSql(filtros.produto);
    conditions.push('(prod.nome LIKE ? OR prod.descricao LIKE ?)');
    params.push(like, like);
  }
  if (filtros.comprador?.trim()) {
    conditions.push('p.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.comprador));
  }
  if (filtros.status != null && !Number.isNaN(filtros.status)) {
    conditions.push('c.status = ?');
    params.push(filtros.status);
  }
  if (filtros.dataInicio?.trim()) {
    conditions.push('DATE(c.dataEmissao) >= ?');
    params.push(filtros.dataInicio.trim());
  }
  if (filtros.dataFim?.trim()) {
    conditions.push('DATE(c.dataEmissao) <= ?');
    params.push(filtros.dataFim.trim());
  }

  if (conditions.length === 0) return { sql: '', params };
  return { sql: ' AND ' + conditions.join(' AND '), params };
}

const CAMPOS_NUMERICOS = new Set(['qtde', 'preco_unitario', 'valor_total']);

function toNumero2Casas(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function serializeRow(row: PreCompraCotacaoRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'bigint') {
      result[key] = Number(value);
    } else if (CAMPOS_NUMERICOS.has(key)) {
      result[key] = toNumero2Casas(value);
    } else {
      result[key] = value;
    }
  }
  const status = result.status;
  if (status != null) {
    result.status_label = STATUS_LABELS[Number(status)] ?? String(status);
  }
  return result;
}

export async function listarPreCompraCotacoes(
  filtros: FiltrosPreCompraCotacoes,
  page: number,
  pageSize: number
): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const { sql: filterSql, params: filterParams } = buildFilterSql(filtros);
  const offset = (page - 1) * pageSize;

  const countSql = `SELECT COUNT(*) AS total FROM (${LIST_QUERY}${filterSql}) AS sub`;
  const dataSql =
    `SELECT * FROM (${LIST_QUERY}${filterSql}) AS sub ` +
    `ORDER BY sub.cotacao DESC, sub.fornecedor, sub.codigo_produto ` +
    `LIMIT ? OFFSET ?`;

  const [countRows] = await pool.query<RowDataPacket[]>(countSql, filterParams);
  const total = Number(countRows[0]?.total ?? 0);

  const [rows] = await pool.query<RowDataPacket[]>(dataSql, [...filterParams, pageSize, offset]);
  const items = (rows as PreCompraCotacaoRow[]).map(serializeRow);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listarPreCompraSugestoes(
  campo: CampoSugestaoPreCompra,
  q: string,
  limit: number
): Promise<PreCompraSugestaoRow[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const sql = SUGGEST_QUERIES[campo];
  if (!sql) throw new Error('Campo de sugestão inválido.');

  const term = q.trim() ? termoParaPadraoLikeSql(q) : '%';
  const params = campo === 'produto' ? [term, term, limit] : [term, limit];

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows as PreCompraSugestaoRow[]).filter((r) => r.valor);
}

export async function listarPreCompraFornecedores(nomeCotacao: string): Promise<PreCompraFornecedorRow[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const [rows] = await pool.query<RowDataPacket[]>(FORNECEDORES_QUERY, [nomeCotacao]);
  return rows as PreCompraFornecedorRow[];
}

export async function listarPreCompraContatos(
  nomeCotacao: string,
  fornecedorId: number
): Promise<PreCompraContatoRow[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const [rows] = await pool.query<RowDataPacket[]>(CONTATOS_QUERY, [nomeCotacao, fornecedorId]);
  return rows as PreCompraContatoRow[];
}

export async function buscarDadosPdfPreCompra(
  nomeCotacao: string,
  fornecedorId: number,
  contatoId: number
): Promise<Record<string, unknown> | null> {
  const pool = getNomusPool();
  if (!pool) throw new Error('Conexão Nomus indisponível.');

  const sql =
    PDF_QUERY +
    ' AND c.nome = ? AND pcole.id = ? AND cont.id = ? ' +
    'ORDER BY prod.nome';

  const [rows] = await pool.query<RowDataPacket[]>(sql, [nomeCotacao, fornecedorId, contatoId]);
  if (!rows.length) return null;

  const first = rows[0] as PreCompraCotacaoRow;
  const seenItems = new Set<string>();
  const itens: PreCompraCotacaoRow[] = [];
  const solicitacoesMap = new Map<number, { id: number; data_necessidade: unknown }>();
  let valorTotal = 0;

  for (const raw of rows as PreCompraCotacaoRow[]) {
    const itemKey = `${raw.codigo_produto}|${raw.descricao_produto}|${raw.qtde}|${raw.preco_unitario}`;
    if (!seenItems.has(itemKey)) {
      seenItems.add(itemKey);
      itens.push(raw);
      if (raw.valor_total != null) valorTotal += toNumero2Casas(raw.valor_total) ?? 0;
    }
    const solId = raw.solicitacao_id;
    if (solId != null && !solicitacoesMap.has(solId)) {
      solicitacoesMap.set(solId, { id: solId, data_necessidade: raw.data_necessidade });
    }
  }

  return {
    ...serializeRow(first),
    itens: itens.map(serializeRow),
    solicitacoes: Array.from(solicitacoesMap.values()).map((s) => ({
      id: s.id,
      data_necessidade:
        s.data_necessidade instanceof Date
          ? s.data_necessidade.toISOString()
          : s.data_necessidade,
    })),
    valor_total_geral: Math.round(valorTotal * 100) / 100,
  };
}

export { PDF_QUERY };
