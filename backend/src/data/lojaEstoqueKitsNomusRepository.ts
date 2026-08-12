/**
 * Consultas Nomus para Loja — documentos de saída vinculados a pedidos de venda.
 */
import type { RowDataPacket } from 'mysql2';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export type LojaDocumentoSaidaNomus = {
  documentoId: string;
  numero: string;
  dataEmissao: string;
  tipoMovimentacao: string;
  clienteNome: string;
  /** Pedidos distintos vinculados ao documento. */
  pedidos: { pedidoId: string; numero: string }[];
};

export type LojaItemDocumentoSaidaNomus = {
  codigo: string;
  descricao: string;
  quantidade: number;
  pedidoId: string;
  pedidoNumero: string;
};

const DOC_INITIAL_LIMIT = 20;
const DOC_SEARCH_LIMIT = 50;
const DOC_MIN_SEARCH_CHARS = 2;

function formatDateSql(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : '';
}

/**
 * Busca documentos de saída (com vínculo a pedido de venda) por número fiscal.
 * Critério: COALESCE(ide.idDocumentoSaida, ide.idDocumentoEstoque) = documentoestoque.id
 * (NF-e de saída costuma gravar só em idDocumentoEstoque) + vínculo via
 * itemdocumentoestoque_itempedidovenda.
 */
export async function buscarDocumentosSaidaNomus(options: {
  q?: string;
  limit?: number;
}): Promise<{ documentos: LojaDocumentoSaidaNomus[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { documentos: [], source: 'indisponivel' };

  const limit = Math.min(Math.max(options.limit ?? DOC_INITIAL_LIMIT, 1), DOC_SEARCH_LIMIT);
  const q = options.q?.trim() ?? '';

  const baseFrom = `
    FROM documentoestoque de
    INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
    INNER JOIN itemdocumentoestoque ide
      ON COALESCE(ide.idDocumentoSaida, ide.idDocumentoEstoque) = de.id
    INNER JOIN itemdocumentoestoque_itempedidovenda ideipv
      ON ideipv.idItemDocumentoEstoque = ide.id
    INNER JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    LEFT JOIN pessoa pec ON pec.id = COALESCE(de.idParceiro, pd.idCliente)
    WHERE de.numeroDocumentoFiscal IS NOT NULL
      AND TRIM(CAST(de.numeroDocumentoFiscal AS CHAR)) <> ''
      AND pd.idEmpresa IN (1, 2)
  `;

  const params: unknown[] = [];
  let whereExtra = '';
  if (q.length >= DOC_MIN_SEARCH_CHARS) {
    const like = termoParaPadraoLikeSql(q);
    const qDigits = q.replace(/\D/g, '');
    whereExtra = `
      AND (
        CAST(de.numeroDocumentoFiscal AS CHAR) LIKE ?
        OR CAST(de.numeroDocumentoFiscal AS CHAR) = ?
        ${qDigits ? 'OR CAST(de.numeroDocumentoFiscal AS CHAR) = ?' : ''}
      )
    `;
    params.push(like, q);
    if (qDigits) params.push(qDigits);
  }

  const [idRows] = await pool.query<RowDataPacket[]>(
    `
    SELECT DISTINCT de.id AS documentoId
    ${baseFrom}
    ${whereExtra}
    ORDER BY de.dataEmissao DESC, de.id DESC
    LIMIT ?
    `,
    [...params, limit],
  );

  const ids = (idRows as { documentoId: number | string }[])
    .map((r) => String(r.documentoId ?? '').trim())
    .filter(Boolean);

  if (ids.length === 0) return { documentos: [], source: 'erp' };

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      de.id AS documentoId,
      CAST(de.numeroDocumentoFiscal AS CHAR) AS numero,
      de.dataEmissao,
      COALESCE(tm.nome, '') AS tipoMovimentacao,
      COALESCE(pec.nomeRazaoSocial, pec.nome, '') AS clienteNome,
      pd.id AS pedidoId,
      pd.nome AS pedidoNumero
    FROM documentoestoque de
    INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
    INNER JOIN itemdocumentoestoque ide
      ON COALESCE(ide.idDocumentoSaida, ide.idDocumentoEstoque) = de.id
    INNER JOIN itemdocumentoestoque_itempedidovenda ideipv
      ON ideipv.idItemDocumentoEstoque = ide.id
    INNER JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    LEFT JOIN pessoa pec ON pec.id = COALESCE(de.idParceiro, pd.idCliente)
    WHERE de.id IN (${placeholders})
    ORDER BY de.dataEmissao DESC, de.id DESC, pd.nome ASC
    `,
    ids,
  );

  const map = new Map<string, LojaDocumentoSaidaNomus>();
  for (const row of rows as Record<string, unknown>[]) {
    const documentoId = String(row.documentoId ?? '').trim();
    if (!documentoId) continue;
    let doc = map.get(documentoId);
    if (!doc) {
      doc = {
        documentoId,
        numero: String(row.numero ?? '').trim(),
        dataEmissao: formatDateSql(row.dataEmissao),
        tipoMovimentacao: String(row.tipoMovimentacao ?? '').trim(),
        clienteNome: String(row.clienteNome ?? '').trim(),
        pedidos: [],
      };
      map.set(documentoId, doc);
    }
    const pedidoId = String(row.pedidoId ?? '').trim();
    const pedidoNumero = String(row.pedidoNumero ?? '').trim();
    if (pedidoId && pedidoNumero && !doc.pedidos.some((p) => p.pedidoId === pedidoId)) {
      doc.pedidos.push({ pedidoId, numero: pedidoNumero });
    }
  }

  // Preserve search order by ids
  const documentos = ids.map((id) => map.get(id)).filter((d): d is LojaDocumentoSaidaNomus => !!d);
  return { documentos, source: 'erp' };
}

/** Itens do documento de saída com produto, quantidade e pedido vinculado. */
export async function buscarItensDocumentoSaidaNomus(
  documentoId: string,
): Promise<{ itens: LojaItemDocumentoSaidaNomus[]; source: 'erp' | 'indisponivel' }> {
  const pool = getNomusPool();
  if (!pool || !isNomusEnabled()) return { itens: [], source: 'indisponivel' };

  const id = String(documentoId ?? '').trim();
  if (!id) return { itens: [], source: 'erp' };

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      pr.nome AS codigo,
      COALESCE(NULLIF(pr.descricao, ''), NULLIF(pr.descricaoNFe, ''), pr.nome) AS descricao,
      SUM(ide.qtde) AS quantidade,
      pd.id AS pedidoId,
      pd.nome AS pedidoNumero
    FROM itemdocumentoestoque ide
    INNER JOIN itemdocumentoestoque_itempedidovenda ideipv
      ON ideipv.idItemDocumentoEstoque = ide.id
    INNER JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
    INNER JOIN pedido pd ON pd.id = ip.idPedido
    INNER JOIN produto pr ON pr.id = COALESCE(ide.idProduto, ip.idProduto)
    WHERE COALESCE(ide.idDocumentoSaida, ide.idDocumentoEstoque) = ?
    GROUP BY pr.id, pr.nome, pr.descricao, pr.descricaoNFe, pd.id, pd.nome
    ORDER BY pd.nome ASC, pr.nome ASC
    `,
    [id],
  );

  const itens: LojaItemDocumentoSaidaNomus[] = (rows as Record<string, unknown>[]).map((row) => {
    const qtde = Number(row.quantidade);
    return {
      codigo: String(row.codigo ?? '').trim(),
      descricao: String(row.descricao ?? '').trim(),
      quantidade: Number.isFinite(qtde) ? qtde : 0,
      pedidoId: String(row.pedidoId ?? '').trim(),
      pedidoNumero: String(row.pedidoNumero ?? '').trim(),
    };
  }).filter((i) => i.codigo && i.pedidoId);

  return { itens, source: 'erp' };
}
