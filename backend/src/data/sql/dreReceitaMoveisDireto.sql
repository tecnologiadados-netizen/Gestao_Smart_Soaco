-- DRE 1.4.1 Faturamento Direto (Só Móveis) — agregado por data de emissão NF.
-- Parâmetros: psm (1,2), período de.dataEmissao (3,4), idEmpresaSaida (5).
SELECT
  base.mes,
  base.ano,
  base.dataEmissao,
  SUM(base.valorTotal) AS valorTotal,
  SUM(base.totalDesconto) AS totalDesconto
FROM (
  SELECT
    ide.id AS idItemDocumentoEstoque,
    DATE(de.dataEmissao) AS dataEmissao,
    MONTH(de.dataEmissao) AS mes,
    YEAR(de.dataEmissao) AS ano,
    MAX(ide.valorTotal) AS valorTotal,
    MAX(ide.valorDesconto) AS totalDesconto
  FROM itemdocumentoestoque ide
  LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
  LEFT JOIN documentoestoque de ON ide.idDocumentoSaida = de.id
  LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
  LEFT JOIN produto p ON p.id = ide.idProduto
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
    psm.idItemPedido IS NOT NULL
    AND (nfe.status IS NULL OR nfe.status IN (1, 3, 4))
    AND tm.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 139, 64, 92)
    AND DATE(de.dataEmissao) BETWEEN ? AND ?
    AND de.idEmpresaSaida = ?
    AND de.numeroDocumentoFiscal IS NOT NULL
    AND TRIM(CAST(de.numeroDocumentoFiscal AS CHAR)) <> ''
  GROUP BY
    ide.id,
    DATE(de.dataEmissao),
    MONTH(de.dataEmissao),
    YEAR(de.dataEmissao)
) base
GROUP BY
  base.mes,
  base.ano,
  base.dataEmissao
ORDER BY
  base.dataEmissao
