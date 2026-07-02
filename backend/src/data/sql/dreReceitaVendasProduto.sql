-- Classificação Só Móveis (psm): pedido.dataEmissao >= 2024-01-01 (parâmetro 1), idEmpresa (2).
-- Período NF: de.dataEmissao BETWEEN parâmetros 3 e 4, idEmpresaSaida (5).
-- NOT EXISTS Só Móveis: parâmetros 6 e 7 (= 1 e 2).
SELECT
  base.mes,
  base.ano,
  base.grupoProduto,
  base.idItemPedidoSM,
  SUM(base.valorTotal) AS valorTotal,
  SUM(base.totalDesconto) AS totalDesconto
FROM (
  SELECT
    ide.id AS idItemDocumentoEstoque,
    MONTH(de.dataEmissao) AS mes,
    YEAR(de.dataEmissao) AS ano,
    COALESCE(gp.nome, 'Outros') AS grupoProduto,
    IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco') AS idItemPedidoSM,
    MAX(ide.valorTotal) AS valorTotal,
    MAX(ide.valorDesconto) AS totalDesconto
  FROM itemdocumentoestoque ide
  LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
  LEFT JOIN documentoestoque de ON ide.idDocumentoSaida = de.id
  LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
  LEFT JOIN produto p ON p.id = ide.idProduto
  LEFT JOIN grupoproduto gp ON p.idGrupoProduto = gp.id
  LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv ON ideipv.idItemDocumentoEstoque = ide.id
  LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
  LEFT JOIN pedido pd ON pd.id = ip.idPedido
  LEFT JOIN (
    SELECT ip.id AS idItemPedido
    FROM itempedido ip
    LEFT JOIN pedido pd ON pd.id = ip.idPedido
    LEFT JOIN (
      SELECT apv.idPedido, apv.idListaOpcao
      FROM atributopedidovalor apv
      WHERE apv.idAtributo = 592
    ) vor ON vor.idPedido = pd.id
    LEFT JOIN (
      SELECT apv.idPedido, alo.opcao
      FROM atributopedidovalor apv
      LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
      WHERE apv.idAtributo = 313
    ) req ON req.idPedido = pd.id
    WHERE pd.dataEmissao >= ?
      AND pd.idEmpresa = ?
      AND vor.idListaOpcao = 2377
      AND req.opcao <> 'Sim'
  ) psm ON psm.idItemPedido = ip.id
  WHERE
    (nfe.status IS NULL OR nfe.status IN (1, 3, 4))
    AND tm.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 64, 92)
    AND DATE(de.dataEmissao) BETWEEN ? AND ?
    AND de.idEmpresaSaida = ?
    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
    AND de.numeroDocumentoFiscal NOT IN (
      128748, 127108, 133953, 133950, 133948, 133947, 133956, 133951,
      133949, 133957, 133961, 133876
    )
  GROUP BY
    ide.id,
    ide.idProduto,
    MONTH(de.dataEmissao),
    YEAR(de.dataEmissao),
    COALESCE(gp.nome, 'Outros'),
    IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco')
) base
WHERE base.idItemPedidoSM = 'So Aco'
GROUP BY
  base.mes,
  base.ano,
  base.grupoProduto,
  base.idItemPedidoSM
