-- DRE 2.1.1.1 / 2.1.1.2 — Detalhe de Devoluções (Só Aço / Só Móveis) item a item.
-- Mesma base do agregado (dreDevolucoesNomus.sql). Pedido e cliente são só colunas
-- extras (subconsulta escalar e parceiro do documento) para não duplicar valorTotal.
-- Parâmetros: data mínima fixa (1), dataInicio (2), dataFim (3), idEmpresaEntrada IN (4), LIMIT (5).
SELECT
  ide.id AS idItemDocumentoEstoque,
  de.id AS idDocumentoEstoque,
  de.idEmpresaEntrada,
  DATE(de.dataEmissao) AS dataEmissao,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  nfe.numero AS numeroNfe,
  tm.nome AS tipoMovimentacao,
  ide.idProduto,
  pd.nome AS produto,
  COALESCE(gp.nome, 'Outros') AS grupoProduto,
  ide.qtde,
  ide.valorUnitario,
  ide.valorTotal,
  parc.nome AS cliente,
  (
    SELECT pdx.nome
    FROM itemdocumentoestoque_itempedidovenda ideipv
    INNER JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
    INNER JOIN pedido pdx ON pdx.id = ip.idPedido
    WHERE ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao
    ORDER BY pdx.id
    LIMIT 1
  ) AS pedido
FROM itemdocumentoestoque ide
LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
LEFT JOIN documentoestoque de ON ide.idDocumentoEstoque = de.id
LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
LEFT JOIN produto pd ON pd.id = ide.idProduto
LEFT JOIN grupoproduto gp ON pd.idGrupoProduto = gp.id
LEFT JOIN pessoa parc ON parc.id = de.idParceiro
WHERE (ISNULL(nfe.status) = 1 OR nfe.status = 4)
  AND tm.id IN (52, 170, 179)
  AND DATE(de.dataEmissao) >= ?
  AND DATE(de.dataEmissao) BETWEEN ? AND ?
  AND de.idEmpresaEntrada IN (?)
ORDER BY de.dataEmissao DESC, ide.id DESC
LIMIT ?
