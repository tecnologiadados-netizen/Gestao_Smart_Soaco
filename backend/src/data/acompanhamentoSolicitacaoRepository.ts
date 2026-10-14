/**
 * PCP — acompanhamento da solicitação até a pré-entrada.
 *
 * A etapa Solicitado olha só solicitação Liberada sem pedido.
 * Comprado e Pré-entrada nascem do pedido / documento: a solicitação de origem
 * já pode estar Encerrada depois que o pedido é vinculado.
 */

import {
  formatNomusErroConexao,
  getNomusPool,
  isNomusEnabled,
  nomusQueryWithRetry,
} from '../config/nomusDb.js';
import { PCP_ID_EMPRESA_SO_ACO } from './sql/sqlComprasEstoqueFragments.js';
import { RECEBIMENTO_ID_TIPO_PRE_ENTRADA } from './recebimentoNomusRepository.js';

/** Nomus `solicitacaocompra.status` = Liberada. */
export const SC_STATUS_LIBERADA = 6;

/** Nomus `itempedidocompra.status` com saldo a receber (mesmo corte do PC pendente). */
export const IPC_STATUS_ABERTO_SQL = '2, 3, 4';

/**
 * Corte e cancelado não entram como pré-entrada.
 * No item de pedido de compra, status 1 é o item atendido/encerrado (saldo zerado).
 * É esse status que a pré-entrada grava — e que some da consulta de pedidos em aberto (2, 3, 4).
 */
export const IPC_STATUS_EXCLUIDO_ENCERRADO_SQL = '5, 6';

/** Solicitação Liberada, da empresa, sem nenhum pedido vinculado. */
export const SQL_SC_LIBERADA_SEM_PEDIDO = `
sc.status = ${SC_STATUS_LIBERADA}
AND sc.lixeira IS NULL
AND sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
AND NOT EXISTS (
  SELECT 1
  FROM solicitacaocompraitempedidocompra scipc
  WHERE scipc.idSolicitacaoCompra = sc.id
)
`.trim();

/**
 * Existe solicitação da empresa ligada ao item do pedido.
 * Não filtra status: depois do vínculo a solicitação sai de Liberada e fica Encerrada.
 */
export const SQL_EXISTS_SC_DA_EMPRESA = `
EXISTS (
  SELECT 1
  FROM solicitacaocompraitempedidocompra scipc
  INNER JOIN solicitacaocompra sc ON sc.id = scipc.idSolicitacaoCompra
  WHERE scipc.idItemPedidoCompra = ipc.id
    AND sc.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
    AND sc.lixeira IS NULL
)
`.trim();

/** Pedido em aberto com saldo, tenha a solicitação o status que tiver. */
export const SQL_IPC_COMPRADO = `
ipc.status IN (${IPC_STATUS_ABERTO_SQL})
AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) > 0
AND ${SQL_EXISTS_SC_DA_EMPRESA}
`.trim();

/** Pedido atendido totalmente (saldo zerado) e ainda não cancelado/cortado. */
export const SQL_IPC_ATENDIDO = `
ipc.qtde > 0
AND ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2) <= 0
AND ipc.status NOT IN (${IPC_STATUS_EXCLUIDO_ENCERRADO_SQL})
AND ${SQL_EXISTS_SC_DA_EMPRESA}
`.trim();

export const SQL_DOC_PRE_ENTRADA = `
de.idTipoMovimentacao = ${RECEBIMENTO_ID_TIPO_PRE_ENTRADA}
AND de.idEmpresaEntrada = ${PCP_ID_EMPRESA_SO_ACO}
AND ide.discriminador = 'ItemDocumentoEntrada'
`.trim();

const SQL_GRADE_SOLICITADO = `
SELECT
  sc.idProduto AS idProduto,
  SUM(ROUND(sc.quantidade, 2)) AS qtde,
  DATE_FORMAT(MIN(CAST(sc.dataEmissao AS DATE)), '%Y-%m-%d') AS emissao,
  DATE_FORMAT(MIN(CAST(sc.dataNecessidade AS DATE)), '%Y-%m-%d') AS necessidade
FROM solicitacaocompra sc
WHERE ${SQL_SC_LIBERADA_SEM_PEDIDO}
  AND ROUND(sc.quantidade, 2) > 0
GROUP BY sc.idProduto
`.trim();

const SQL_GRADE_COMPRADO = `
SELECT
  ipc.idProduto AS idProduto,
  SUM(ROUND(ipc.qtde - IFNULL(ipc.qtdeAtendida, 0), 2)) AS qtde,
  DATE_FORMAT(MIN(CAST(pc.dataEmissao AS DATE)), '%Y-%m-%d') AS emissao
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ${SQL_IPC_COMPRADO}
GROUP BY ipc.idProduto
`.trim();

const SQL_GRADE_PRE_ENTRADA = `
SELECT
  pre.idProduto AS idProduto,
  SUM(pre.qtde) AS qtde,
  DATE_FORMAT(MIN(pre.dataEmissao), '%Y-%m-%d') AS emissao
FROM (
  SELECT
    ide.id AS idItem,
    ide.idProduto AS idProduto,
    ROUND(ide.qtde, 2) AS qtde,
    CAST(de.dataEmissao AS DATE) AS dataEmissao
  FROM itemdocumentoestoque ide
  INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
  INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
  INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
  WHERE ${SQL_DOC_PRE_ENTRADA}
    AND ${SQL_IPC_ATENDIDO}
    AND ROUND(ide.qtde, 2) > 0
  GROUP BY ide.id, ide.idProduto, ide.qtde, CAST(de.dataEmissao AS DATE)
) pre
GROUP BY pre.idProduto
`.trim();

const SQL_DETALHE_SOLICITADO = `
SELECT
  sc.id AS idSolicitacao,
  u.nome AS usuario,
  DATE_FORMAT(CAST(sc.dataEmissao AS DATE), '%d/%m/%Y') AS dataEmissao,
  DATE_FORMAT(CAST(sc.dataNecessidade AS DATE), '%d/%m/%Y') AS dataNecessidade,
  ROUND(sc.quantidade, 2) AS qtde
FROM solicitacaocompra sc
LEFT JOIN usuario u ON u.id = sc.idUsuario
WHERE sc.idProduto = ?
  AND ${SQL_SC_LIBERADA_SEM_PEDIDO}
  AND ROUND(sc.quantidade, 2) > 0
ORDER BY sc.dataNecessidade, sc.id
`.trim();

/** Solicitação da empresa ligada ao item do pedido, para exibir o vínculo sem multiplicar a quantidade. */
const SQL_JOIN_SC_VINCULO = `
LEFT JOIN solicitacaocompraitempedidocompra scipc_v ON scipc_v.idItemPedidoCompra = ipc.id
LEFT JOIN solicitacaocompra sc_v
  ON sc_v.id = scipc_v.idSolicitacaoCompra
 AND sc_v.idEmpresa = ${PCP_ID_EMPRESA_SO_ACO}
 AND sc_v.lixeira IS NULL
`.trim();

const SQL_DETALHE_COMPRADO = `
SELECT
  ipc.id AS idItem,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR ', ') AS solicitacoes,
  MAX(pc.nome) AS pedido,
  MAX(forn.nome) AS fornecedor,
  MAX(
    CASE
      WHEN ipc.dataEntrega IS NULL THEN NULL
      ELSE DATE_FORMAT(CAST(ipc.dataEntrega AS DATE), '%d/%m/%Y')
    END
  ) AS dataEntrega,
  ROUND(MAX(ipc.qtde) - IFNULL(MAX(ipc.qtdeAtendida), 0), 2) AS qtde
FROM itempedidocompra ipc
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
LEFT JOIN pessoa forn ON forn.id = pc.idFornecedor
${SQL_JOIN_SC_VINCULO}
WHERE ipc.idProduto = ?
  AND ${SQL_IPC_COMPRADO}
GROUP BY ipc.id
ORDER BY dataEntrega IS NULL, dataEntrega, pedido, ipc.id
`.trim();

const SQL_DETALHE_PRE_ENTRADA = `
SELECT
  ide.id AS idItem,
  de.numeroDocumentoFiscal AS numeroDocumento,
  MAX(nfe.numero) AS numeroNfe,
  GROUP_CONCAT(DISTINCT sc_v.id ORDER BY sc_v.id SEPARATOR ', ') AS solicitacoes,
  MAX(forn.nome) AS fornecedor,
  MAX(DATE_FORMAT(CAST(de.dataEmissao AS DATE), '%d/%m/%Y')) AS dataEmissao,
  GROUP_CONCAT(DISTINCT NULLIF(TRIM(pc.nome), '') ORDER BY pc.nome SEPARATOR ', ') AS pedidos,
  ROUND(ide.qtde, 2) AS qtde
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
${SQL_JOIN_SC_VINCULO}
LEFT JOIN pessoa forn ON forn.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE ide.idProduto = ?
  AND ${SQL_DOC_PRE_ENTRADA}
  AND ${SQL_IPC_ATENDIDO}
  AND ROUND(ide.qtde, 2) > 0
GROUP BY ide.id, de.numeroDocumentoFiscal, ide.qtde
ORDER BY MAX(de.id) DESC, ide.id
`.trim();

export type EtapaAcompanhamento = 'solicitado' | 'comprado' | 'pre_entrada';

export type LinhaAcompanhamento = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  qtdeSolicitado: number;
  qtdeComprado: number;
  qtdePreEntrada: number;
  /** Mais antiga ainda na etapa, YYYY-MM-DD. */
  emissaoSolicitacao: string | null;
  necessidadeSolicitacao: string | null;
  emissaoPedido: string | null;
  emissaoPreEntrada: string | null;
};

export type AggSolicitado = { qtde: number; emissao: string | null; necessidade: string | null };
export type AggComprado = { qtde: number; emissao: string | null };
export type AggPreEntrada = { qtde: number; emissao: string | null };

export type LinhaDetalheSolicitado = {
  idSolicitacao: number;
  usuario: string | null;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  qtde: number;
};

export type LinhaDetalheComprado = {
  idItem: number;
  solicitacoes: string | null;
  pedido: string;
  fornecedor: string | null;
  dataEntrega: string | null;
  qtde: number;
};

export type LinhaDetalhePreEntrada = {
  idItem: number;
  numeroDocumento: string | null;
  numeroNfe: string | null;
  solicitacoes: string | null;
  fornecedor: string | null;
  dataEmissao: string | null;
  pedidos: string | null;
  qtde: number;
  situacao: 'Pré-entrada';
};

type ProdutoBase = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function montarLinhasPipeline(
  produtos: ProdutoBase[],
  solicitado: Map<number, AggSolicitado>,
  comprado: Map<number, AggComprado>,
  preEntrada: Map<number, AggPreEntrada>
): LinhaAcompanhamento[] {
  const linhas: LinhaAcompanhamento[] = [];
  for (const p of produtos) {
    const sol = solicitado.get(p.idProduto);
    const comp = comprado.get(p.idProduto);
    const pre = preEntrada.get(p.idProduto);
    const qtdeSolicitado = round2(sol?.qtde ?? 0);
    const qtdeComprado = round2(comp?.qtde ?? 0);
    const qtdePreEntrada = round2(pre?.qtde ?? 0);
    if (qtdeSolicitado <= 0 && qtdeComprado <= 0 && qtdePreEntrada <= 0) continue;
    linhas.push({
      idProduto: p.idProduto,
      codigo: p.codigo,
      descricao: p.descricao,
      unidadeMedida: p.unidadeMedida,
      qtdeSolicitado,
      qtdeComprado,
      qtdePreEntrada,
      emissaoSolicitacao: qtdeSolicitado > 0 ? (sol?.emissao ?? null) : null,
      necessidadeSolicitacao: qtdeSolicitado > 0 ? (sol?.necessidade ?? null) : null,
      emissaoPedido: qtdeComprado > 0 ? (comp?.emissao ?? null) : null,
      emissaoPreEntrada: qtdePreEntrada > 0 ? (pre?.emissao ?? null) : null,
    });
  }
  linhas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  return linhas;
}

function ymdOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
}

async function queryAgg(sql: string): Promise<Record<string, unknown>[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
  return Array.isArray(rows) ? rows : [];
}

async function mapaSolicitado(): Promise<Map<number, AggSolicitado>> {
  const map = new Map<number, AggSolicitado>();
  for (const r of await queryAgg(SQL_GRADE_SOLICITADO)) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) {
      map.set(id, { qtde, emissao: ymdOrNull(r.emissao), necessidade: ymdOrNull(r.necessidade) });
    }
  }
  return map;
}

async function mapaComprado(): Promise<Map<number, AggComprado>> {
  const map = new Map<number, AggComprado>();
  for (const r of await queryAgg(SQL_GRADE_COMPRADO)) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) map.set(id, { qtde, emissao: ymdOrNull(r.emissao) });
  }
  return map;
}

async function mapaPreEntrada(): Promise<Map<number, AggPreEntrada>> {
  const map = new Map<number, AggPreEntrada>();
  for (const r of await queryAgg(SQL_GRADE_PRE_ENTRADA)) {
    const id = toInt(r.idProduto);
    const qtde = round2(toNum(r.qtde));
    if (id > 0 && qtde > 0) map.set(id, { qtde, emissao: ymdOrNull(r.emissao) });
  }
  return map;
}

async function listarProdutos(ids: number[]): Promise<ProdutoBase[]> {
  if (ids.length === 0) return [];
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const ph = ids.map(() => '?').join(', ');
  const sql = `
SELECT
  p.id AS idProduto,
  p.nome AS codigo,
  p.descricao AS descricao,
  COALESCE(NULLIF(TRIM(umed.abreviatura), ''), NULLIF(TRIM(umed.nome), ''), '') AS unidadeMedida
FROM produto p
LEFT JOIN unidademedida umed ON umed.id = p.idUnidadeMedida
WHERE p.id IN (${ph})
`.trim();
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, ids);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    idProduto: toInt(r.idProduto),
    codigo: strOrNull(r.codigo) ?? String(toInt(r.idProduto)),
    descricao: strOrNull(r.descricao) ?? '',
    unidadeMedida: strOrNull(r.unidadeMedida) ?? '',
  }));
}

function exigirNomus(): string | null {
  if (!isNomusEnabled() || !getNomusPool()) return 'NOMUS_DB_URL não configurado';
  return null;
}

export async function listarPipelineAcompanhamento(): Promise<{
  linhas: LinhaAcompanhamento[];
  erro?: string;
}> {
  const off = exigirNomus();
  if (off) return { linhas: [], erro: off };
  try {
    const [solicitado, comprado, preEntrada] = await Promise.all([
      mapaSolicitado(),
      mapaComprado(),
      mapaPreEntrada(),
    ]);
    const ids = [...new Set([...solicitado.keys(), ...comprado.keys(), ...preEntrada.keys()])];
    const produtos = await listarProdutos(ids);
    return { linhas: montarLinhasPipeline(produtos, solicitado, comprado, preEntrada) };
  } catch (err) {
    return { linhas: [], erro: formatNomusErroConexao(err) };
  }
}

async function queryDetalhe(sql: string, idProduto: number): Promise<Record<string, unknown>[]> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, [idProduto]);
  return Array.isArray(rows) ? rows : [];
}

export async function listarDetalheAcompanhamento(
  idProduto: number,
  etapa: EtapaAcompanhamento
): Promise<{
  linhas: LinhaDetalheSolicitado[] | LinhaDetalheComprado[] | LinhaDetalhePreEntrada[];
  erro?: string;
}> {
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    return { linhas: [], erro: 'Produto inválido.' };
  }
  const off = exigirNomus();
  if (off) return { linhas: [], erro: off };
  try {
    if (etapa === 'solicitado') {
      const rows = await queryDetalhe(SQL_DETALHE_SOLICITADO, idProduto);
      const linhas: LinhaDetalheSolicitado[] = rows.map((r) => ({
        idSolicitacao: toInt(r.idSolicitacao),
        usuario: strOrNull(r.usuario),
        dataEmissao: strOrNull(r.dataEmissao),
        dataNecessidade: strOrNull(r.dataNecessidade),
        qtde: round2(toNum(r.qtde)),
      }));
      return { linhas };
    }
    if (etapa === 'comprado') {
      const rows = await queryDetalhe(SQL_DETALHE_COMPRADO, idProduto);
      const linhas: LinhaDetalheComprado[] = rows.map((r) => ({
        idItem: toInt(r.idItem),
        solicitacoes: strOrNull(r.solicitacoes),
        pedido: strOrNull(r.pedido) ?? '—',
        fornecedor: strOrNull(r.fornecedor),
        dataEntrega: strOrNull(r.dataEntrega),
        qtde: round2(toNum(r.qtde)),
      }));
      return { linhas };
    }
    const rows = await queryDetalhe(SQL_DETALHE_PRE_ENTRADA, idProduto);
    const linhas: LinhaDetalhePreEntrada[] = rows.map((r) => ({
      idItem: toInt(r.idItem),
      numeroDocumento: strOrNull(r.numeroDocumento),
      numeroNfe: strOrNull(r.numeroNfe),
      solicitacoes: strOrNull(r.solicitacoes),
      fornecedor: strOrNull(r.fornecedor),
      dataEmissao: strOrNull(r.dataEmissao),
      pedidos: strOrNull(r.pedidos),
      qtde: round2(toNum(r.qtde)),
      situacao: 'Pré-entrada',
    }));
    return { linhas };
  } catch (err) {
    return { linhas: [], erro: formatNomusErroConexao(err) };
  }
}
