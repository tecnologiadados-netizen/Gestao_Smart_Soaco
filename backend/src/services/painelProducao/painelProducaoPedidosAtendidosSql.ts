/**
 * Pedidos atendidos para meta (Gôndolas / Porta Paletes e apuração qualitativa).
 *
 * Regra: o pedido só conta no mês da emissão do **último documento de saída**
 * vinculado a ele (qualquer doc.; não exige NF autorizada).
 *
 * Pedido “fechado” = todos os itens em status terminal:
 *   4 = Atendido totalmente, 5 = Atendido com corte, 6 = Cancelado.
 * Itens cancelados (6) não bloqueiam e não entram na contagem do setor.
 * Pedidos ainda abertos (status 1/2/3 etc.) não entram.
 */

/** Status de item que encerram a linha sem pendência de atendimento. */
export const STATUS_ITEM_TERMINAL_SQL = '4, 5, 6';

/** Status que efetivamente contabilizam na meta (atendidos). */
export const STATUS_ITEM_ATENDIDO_SQL = '4, 5';

/**
 * Subconsulta: id_pedido + data_atendimento (MAX dataEmissao dos docs de saída),
 * já filtrada pelo intervalo [? , ?) via HAVING (2 params).
 */
export const SQL_PEDIDO_DATA_ATENDIMENTO = `
  SELECT
    ipd.idPedido AS id_pedido,
    MAX(de.dataEmissao) AS data_atendimento
  FROM itempedido ipd
  INNER JOIN itemdocumentoestoque_itempedidovenda ideipv
    ON ideipv.idItemPedidoVenda = ipd.id
  INNER JOIN itemdocumentoestoque ide
    ON ide.id = ideipv.idItemDocumentoEstoque
  INNER JOIN documentoestoque de
    ON de.id = COALESCE(ide.idDocumentoSaida, ide.idDocumentoEstoque)
  WHERE de.dataEmissao IS NOT NULL
  GROUP BY ipd.idPedido
  HAVING MAX(de.dataEmissao) >= ?
     AND MAX(de.dataEmissao) < ?
`;

/**
 * Itens atendidos (status 4/5) de pedidos já fechados (só terminais 4/5/6),
 * cuja data de atendimento (último doc. de saída) cai no intervalo [? , ?).
 * Params: [inicio, fim] (HAVING da subconsulta).
 */
export const SQL_PEDIDOS_ATENDIDOS_POR_DOC_SAIDA = `
SELECT
    ip.idProduto AS id_produto,
    DATE(ult.data_atendimento) AS dt,
    pe.id AS id_pedido,
    pe.nome AS codigo_pedido,
    COALESCE(pec.nomeRazaoSocial, pec.nome, '—') AS cliente,
    pd.nome AS codigo_produto,
    COALESCE(NULLIF(pd.descricao, ''), NULLIF(pd.descricaoNFe, ''), '—') AS descricao_produto,
    ult.data_atendimento AS data_atendimento
FROM itempedido ip
INNER JOIN pedido pe ON ip.idPedido = pe.id
LEFT JOIN pessoa pec ON pe.idCliente = pec.id
INNER JOIN produto pd ON ip.idProduto = pd.id
INNER JOIN (
${SQL_PEDIDO_DATA_ATENDIMENTO}
) ult ON ult.id_pedido = pe.id
WHERE pe.idEmpresa IN (1, 2)
  AND ip.status IN (${STATUS_ITEM_ATENDIDO_SQL})
  AND NOT EXISTS (
    SELECT 1
    FROM itempedido ipx
    WHERE ipx.idPedido = pe.id
      AND ipx.status NOT IN (${STATUS_ITEM_TERMINAL_SQL})
  )
`;
