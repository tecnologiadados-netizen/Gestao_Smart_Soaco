-- DRE 6.2.1 CPV Direto (Só Móveis) — item a item: faturamento PSM + última entrada Nomus antes da NF.
-- Parâmetros: psm data min (1), psm idEmpresa (2), NF data início (3), NF data fim (4), idEmpresaSaida (5), idEmpresaEntrada (6).
WITH faturamento AS (
  SELECT
    ide.id AS idItemDocumentoEstoque,
    DATE(de.dataEmissao) AS dataEmissao,
    de.dataEmissao AS dataHoraFaturamento,
    MONTH(de.dataEmissao) AS mes,
    YEAR(de.dataEmissao) AS ano,
    ide.valorTotalComDesconto,
    ide.valorTotal,
    ide.valorDesconto,
    ide.qtde,
    ide.valorUnitario,
    ide.idProduto,
    p.nome AS codigoProduto,
    p.nome AS produto,
    ip.id AS idItemPedido,
    pd.nome AS pedido,
    de.numeroDocumentoFiscal,
    tm.nome AS tipoMovimentacao
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
),
entradas AS (
  SELECT
    de.id AS idDocumentoEntrada,
    de.dataEmissao AS dataHoraEntrada,
    DATE(de.dataEmissao) AS dataEntrada,
    de.idParceiro,
    ide.idProduto,
    p.nome AS produtoEntrada,
    de.idTipoMovimentacao,
    tm.nome AS tipoMovimentacaoEntrada,
    ide.qtde AS qtdeEntrada,
    ide.valorUnitario AS custoUnitarioEntrada,
    ide.valorTotalComDesconto AS valorTotalEntrada
  FROM itemdocumentoestoque ide
  LEFT JOIN documentoestoque de ON de.id = ide.idDocumentoEntrada
  LEFT JOIN produto p ON p.id = ide.idProduto
  LEFT JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
  WHERE
    de.idEmpresaEntrada = ?
    AND tm.id IN (161, 165, 158, 46)
),
faturamento_com_custo AS (
  SELECT
    f.*,
    e.idDocumentoEntrada,
    e.dataEntrada,
    e.tipoMovimentacaoEntrada,
    e.custoUnitarioEntrada,
    ROW_NUMBER() OVER (
      PARTITION BY f.idItemDocumentoEstoque
      ORDER BY e.dataHoraEntrada DESC, e.idDocumentoEntrada DESC
    ) AS rn
  FROM faturamento f
  LEFT JOIN entradas e
    ON e.idProduto = f.idProduto
   AND e.dataHoraEntrada <= f.dataHoraFaturamento
)
SELECT
  idItemDocumentoEstoque,
  dataEmissao,
  mes,
  ano,
  qtde,
  codigoProduto,
  produto,
  valorTotal,
  custoUnitarioEntrada,
  CASE
    WHEN custoUnitarioEntrada IS NOT NULL AND custoUnitarioEntrada > 0
      THEN qtde * custoUnitarioEntrada
    ELSE NULL
  END AS custoTotal
FROM faturamento_com_custo
WHERE rn = 1
