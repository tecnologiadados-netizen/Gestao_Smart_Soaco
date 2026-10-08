/**
 * Recebimento — documentos Nomus de pré-entrada (somente leitura).
 */

import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { PCP_ID_EMPRESA_SO_ACO } from './sql/sqlComprasEstoqueFragments.js';

/** Nomus `documentoestoque.idEmpresaEntrada` — Só Aço Industrial. */
export const RECEBIMENTO_ID_EMPRESA_SO_ACO = PCP_ID_EMPRESA_SO_ACO;

export const RECEBIMENTO_STATUS = {
  AGUARDANDO_CONFERENTE: 'AGUARDANDO_CONFERENTE',
  EM_CONFERENCIA: 'EM_CONFERENCIA',
  CONFERIDO: 'CONFERIDO',
  DIVERGENCIA: 'DIVERGENCIA',
  TRATAMENTO_COMPRAS: 'TRATAMENTO_COMPRAS',
  AGUARDANDO_DEVOLUCAO: 'AGUARDANDO_DEVOLUCAO',
  DEVOLUCAO_VINCULADA: 'DEVOLUCAO_VINCULADA',
  FINALIZADO: 'FINALIZADO',
} as const;

export type RecebimentoStatus = (typeof RECEBIMENTO_STATUS)[keyof typeof RECEBIMENTO_STATUS];

export const RECEBIMENTO_STATUS_LABEL: Record<RecebimentoStatus, string> = {
  AGUARDANDO_CONFERENTE: 'Aguardando deliberar conferente',
  EM_CONFERENCIA: 'Em conferência',
  CONFERIDO: 'Aguardando mesa alterar movimentação',
  DIVERGENCIA: 'Com divergência',
  TRATAMENTO_COMPRAS: 'Tratamento compras',
  AGUARDANDO_DEVOLUCAO: 'Aguardando documento de devolução',
  DEVOLUCAO_VINCULADA: 'Devolução vinculada',
  FINALIZADO: 'Concluído',
};

/** Conferência ok sai da fila quando o Nomus deixa de usar um tipo de pré-entrada. */
export function movimentacaoDeixouPreEntrada(
  idTipoMovimentacao: number,
  idsTiposPreEntrada: ReadonlySet<number>
): boolean {
  return idTipoMovimentacao > 0 && !idsTiposPreEntrada.has(idTipoMovimentacao);
}

export type RecebimentoTipoMovimentacao = {
  id: number;
  nome: string;
};

export type RecebimentoDocumentoGrade = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  idParceiro: number | null;
  nomeParceiro: string | null;
  idTipoMovimentacao: number;
  tipoMovimentacao: string | null;
  qtdeItens: number;
  qtdeTotal: number;
  valorTotal: number;
};

export type RecebimentoDocumentoItem = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
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

const SQL_TIPOS = `
SELECT tm.id, tm.nome
FROM tipomovimentacao tm
WHERE tm.nome LIKE '%Pré Entrada%'
   OR tm.nome LIKE '%Pre Entrada%'
   OR tm.nome LIKE '%PRE ENTRADA%'
   OR tm.nome LIKE '%PRÉ ENTRADA%'
   OR tm.nome LIKE '%pré entrada%'
ORDER BY tm.id
`.trim();

const SQL_DOCUMENTOS = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  DATE(de.dataEntrada) AS dataEntrada,
  de.idParceiro AS idParceiro,
  pe.nome AS nomeParceiro,
  tm.id AS idTipoMovimentacao,
  tm.nome AS tipoMovimentacao,
  COUNT(ide.id) AS qtdeItens,
  COALESCE(SUM(ide.qtde), 0) AS qtdeTotal,
  COALESCE(SUM(ide.valorTotal), 0) AS valorTotal
FROM documentoestoque de
INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
LEFT JOIN itemdocumentoestoque ide
  ON ide.idDocumentoEstoque = de.id
 AND ide.discriminador = 'ItemDocumentoEntrada'
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND tm.id IN (__TIPOS__)
GROUP BY
  de.id,
  de.numeroDocumentoFiscal,
  nfe.numero,
  DATE(de.dataEmissao),
  DATE(de.dataEntrada),
  de.idParceiro,
  pe.nome,
  tm.id,
  tm.nome
ORDER BY DATE(COALESCE(de.dataEntrada, de.dataEmissao)) DESC, de.id DESC
LIMIT 2000
`.trim();

const SQL_ITENS = `
SELECT
  ide.id AS idItem,
  ide.idProduto AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  um.nome AS unidadeMedida,
  ide.qtde AS qtde,
  ide.valorUnitario AS valorUnitario,
  ide.valorTotal AS valorTotal
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN unidademedida um ON um.id = p.idUnidadeMedida
WHERE ide.idDocumentoEstoque = ?
  AND de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND ide.discriminador = 'ItemDocumentoEntrada'
ORDER BY ide.id ASC
`.trim();

const SQL_DOCUMENTOS_POR_IDS = `
SELECT
  de.id AS idDocumento,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  DATE(de.dataEmissao) AS dataEmissao,
  DATE(de.dataEntrada) AS dataEntrada,
  de.idParceiro AS idParceiro,
  pe.nome AS nomeParceiro,
  tm.id AS idTipoMovimentacao,
  tm.nome AS tipoMovimentacao
FROM documentoestoque de
INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
LEFT JOIN pessoa pe ON pe.id = de.idParceiro
LEFT JOIN nfe ON nfe.idDocumentoEstoque = de.id
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND de.id IN (__IDS__)
`.trim();

const SQL_LOOKUP_CODIGO = `
SELECT
  ide.id AS idItem,
  ide.idProduto AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  um.nome AS unidadeMedida
FROM itemdocumentoestoque ide
INNER JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
LEFT JOIN produto p ON p.id = ide.idProduto
LEFT JOIN unidademedida um ON um.id = p.idUnidadeMedida
WHERE ide.idDocumentoEstoque = ?
  AND de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND ide.discriminador = 'ItemDocumentoEntrada'
  AND TRIM(p.nome) = ?
ORDER BY ide.id ASC
LIMIT 1
`.trim();

const SQL_DEVOLUCAO_COMPRA_POR_NFE = `
SELECT
  dev.id AS idDocumento,
  dev.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfeDev.numero AS numeroNfe,
  DATE(dev.dataEmissao) AS dataEmissao,
  tm.nome AS tipoMovimentacao
FROM documentoestoque dev
INNER JOIN tipomovimentacao tm ON tm.id = dev.idTipoMovimentacao
INNER JOIN documentoestoque origem ON origem.id = dev.idDocumentoOrigemDevolucao
INNER JOIN nfe nfeOrigem ON nfeOrigem.idDocumentoEstoque = origem.id
LEFT JOIN nfe nfeDev ON nfeDev.idDocumentoEstoque = dev.id
WHERE tm.natureza = 5
  AND dev.idParceiro = ?
  AND CAST(TRIM(nfeOrigem.numero) AS UNSIGNED) = CAST(TRIM(?) AS UNSIGNED)
  AND (
    tm.nome LIKE '%DEVOLUÇÃO DE COMPRA%'
    OR tm.nome LIKE '%Devolução de compra%'
    OR tm.nome LIKE '%DEVOLUCAO DE COMPRA%'
    OR tm.nome LIKE '%Mercadoria para Revenda%'
    OR tm.id = 181
  )
ORDER BY dev.id DESC
LIMIT 1
`.trim();

export type RecebimentoCabecalhoCego = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  idParceiro: number | null;
  nomeParceiro: string | null;
  idTipoMovimentacao: number;
  tipoMovimentacao: string | null;
};

export type RecebimentoProdutoLookup = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
};

export type RecebimentoDocumentoDevolucao = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  tipoMovimentacao: string | null;
};

function mapCabecalho(r: Record<string, unknown>): RecebimentoCabecalhoCego {
  return {
    idDocumento: toInt(r.idDocumento),
    numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal),
    numeroNfe: strOrNull(r.numeroNfe),
    dataEmissao: formatSqlDateYmd(r.dataEmissao),
    dataEntrada: formatSqlDateYmd(r.dataEntrada),
    idParceiro: r.idParceiro != null ? toInt(r.idParceiro) : null,
    nomeParceiro: strOrNull(r.nomeParceiro),
    idTipoMovimentacao: toInt(r.idTipoMovimentacao),
    tipoMovimentacao: strOrNull(r.tipoMovimentacao),
  };
}

export async function queryTiposPreEntradaNomus(): Promise<{
  tipos: RecebimentoTipoMovimentacao[];
  erro?: string;
}> {
  if (!isNomusEnabled()) return { tipos: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { tipos: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_TIPOS);
    const list = Array.isArray(rows) ? rows : [];
    return {
      tipos: list.map((r) => ({
        id: toInt(r.id),
        nome: strOrNull(r.nome) ?? `Tipo ${toInt(r.id)}`,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tipos: [], erro: msg };
  }
}

export async function queryDocumentosPreEntradaNomus(): Promise<{
  documentos: RecebimentoDocumentoGrade[];
  tipos: RecebimentoTipoMovimentacao[];
  erro?: string;
}> {
  const tiposRes = await queryTiposPreEntradaNomus();
  if (tiposRes.erro) return { documentos: [], tipos: [], erro: tiposRes.erro };
  if (tiposRes.tipos.length === 0) {
    return {
      documentos: [],
      tipos: [],
      erro: 'Nenhum tipo de movimentação “Pré Entrada” encontrado no Nomus.',
    };
  }

  const pool = getNomusPool();
  if (!pool) return { documentos: [], tipos: tiposRes.tipos, erro: 'NOMUS_DB_URL não configurado' };

  const ids = tiposRes.tipos.map((t) => t.id).filter((id) => id > 0);
  if (ids.length === 0) {
    return { documentos: [], tipos: tiposRes.tipos };
  }

  try {
    const sql = SQL_DOCUMENTOS.replace('__TIPOS__', ids.join(', '));
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
    const list = Array.isArray(rows) ? rows : [];
    const documentos: RecebimentoDocumentoGrade[] = list.map((r) => ({
      idDocumento: toInt(r.idDocumento),
      numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal),
      numeroNfe: strOrNull(r.numeroNfe),
      dataEmissao: formatSqlDateYmd(r.dataEmissao),
      dataEntrada: formatSqlDateYmd(r.dataEntrada),
      idParceiro: r.idParceiro != null ? toInt(r.idParceiro) : null,
      nomeParceiro: strOrNull(r.nomeParceiro),
      idTipoMovimentacao: toInt(r.idTipoMovimentacao),
      tipoMovimentacao: strOrNull(r.tipoMovimentacao),
      qtdeItens: toInt(r.qtdeItens),
      qtdeTotal: toNum(r.qtdeTotal),
      valorTotal: toNum(r.valorTotal),
    }));
    return { documentos, tipos: tiposRes.tipos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { documentos: [], tipos: tiposRes.tipos, erro: msg };
  }
}

export async function queryItensDocumentoPreEntradaNomus(
  idDocumento: number
): Promise<{ itens: RecebimentoDocumentoItem[]; erro?: string }> {
  if (!isNomusEnabled()) return { itens: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { itens: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_ITENS, [idDocumento]);
    const list = Array.isArray(rows) ? rows : [];
    return {
      itens: list.map((r) => ({
        idItem: toInt(r.idItem),
        idProduto: toInt(r.idProduto),
        codigoProduto: strOrNull(r.codigoProduto),
        descricaoProduto: strOrNull(r.descricaoProduto),
        unidadeMedida: strOrNull(r.unidadeMedida),
        qtde: toNum(r.qtde),
        valorUnitario: toNum(r.valorUnitario),
        valorTotal: toNum(r.valorTotal),
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { itens: [], erro: msg };
  }
}

export async function queryCabecalhosDocumentosNomus(
  idsDocumento: number[]
): Promise<{ documentos: RecebimentoCabecalhoCego[]; erro?: string }> {
  const ids = [...new Set(idsDocumento.map((n) => Math.trunc(Number(n))).filter((n) => n > 0))];
  if (ids.length === 0) return { documentos: [] };
  if (!isNomusEnabled()) return { documentos: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { documentos: [], erro: 'NOMUS_DB_URL não configurado' };

  try {
    const sql = SQL_DOCUMENTOS_POR_IDS.replace('__IDS__', ids.join(', '));
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
    const list = Array.isArray(rows) ? rows : [];
    return { documentos: list.map(mapCabecalho) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { documentos: [], erro: msg };
  }
}

export async function lookupProdutoCodigoDocumentoNomus(
  idDocumento: number,
  codigo: string
): Promise<{ produto: RecebimentoProdutoLookup | null; erro?: string }> {
  if (!isNomusEnabled()) return { produto: null, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { produto: null, erro: 'NOMUS_DB_URL não configurado' };
  const codigoTrim = codigo.trim();
  if (!codigoTrim) return { produto: null };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      SQL_LOOKUP_CODIGO,
      [idDocumento, codigoTrim]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) return { produto: null };
    return {
      produto: {
        idItem: toInt(row.idItem),
        idProduto: toInt(row.idProduto),
        codigoProduto: strOrNull(row.codigoProduto),
        descricaoProduto: strOrNull(row.descricaoProduto),
        unidadeMedida: strOrNull(row.unidadeMedida),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { produto: null, erro: msg };
  }
}

export async function queryDevolucaoCompraPorNfeNomus(params: {
  numeroNfe: string;
  idParceiro: number;
}): Promise<{ documento: RecebimentoDocumentoDevolucao | null; erro?: string }> {
  if (!isNomusEnabled()) return { documento: null, erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { documento: null, erro: 'NOMUS_DB_URL não configurado' };
  if (!params.numeroNfe.trim() || params.idParceiro <= 0) return { documento: null };

  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
      pool,
      SQL_DEVOLUCAO_COMPRA_POR_NFE,
      [params.idParceiro, params.numeroNfe.trim()]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) return { documento: null };
    return {
      documento: {
        idDocumento: toInt(row.idDocumento),
        numeroDocumentoFiscal: strOrNull(row.numeroDocumentoFiscal),
        numeroNfe: strOrNull(row.numeroNfe),
        dataEmissao: formatSqlDateYmd(row.dataEmissao),
        tipoMovimentacao: strOrNull(row.tipoMovimentacao),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { documento: null, erro: msg };
  }
}
