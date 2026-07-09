-- Detalhe faturamento indireto (Só Móveis). psm (1,2), período (3,4,5), grupo opcional (6,7), LIMIT (8).
SELECT
  base.idItemDocumentoEstoque,
  base.idItemPedido,
  base.pedido,
  base.idItemPedidoSM,
  base.dataEmissao,
  base.tipoMovimentacao,
  base.statusNfe,
  base.idProduto,
  base.produto,
  base.qtde,
  base.valorUnitario,
  base.valorTotal,
  base.totalDesconto,
  base.valorTotalComDesconto,
  base.grupoProduto,
  base.familiaProduto,
  base.mes,
  base.ano,
  base.numeroDocumentoFiscal
FROM (
  SELECT
    ide.id AS idItemDocumentoEstoque,
    ip.id AS idItemPedido,
    pd.nome AS pedido,
    IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco') AS idItemPedidoSM,
    DATE(de.dataEmissao) AS dataEmissao,
    tm.nome AS tipoMovimentacao,
    IF(
      nfe.status IS NULL,
      'Sem nota fiscal',
      IF(
        nfe.status = 1,
        'Dados inconsistentes',
        IF(
          nfe.status = 3,
          'Aguardando autorização',
          IF(nfe.status IN (4, 2), 'Autorizada', IF(nfe.status = 5, 'Denegada', 'Outro'))
        )
      )
    ) AS statusNfe,
    ide.idProduto,
    p.nome AS produto,
    ide.qtde,
    ide.valorUnitario,
    MAX(ide.valorTotal) AS valorTotal,
    MAX(ide.valorDesconto) AS totalDesconto,
    MAX(ide.valorTotalComDesconto) AS valorTotalComDesconto,
    COALESCE(gp.nome, 'Outros') AS grupoProduto,
    fp.nome AS familiaProduto,
    MONTH(de.dataEmissao) AS mes,
    YEAR(de.dataEmissao) AS ano,
    de.numeroDocumentoFiscal AS numeroDocumentoFiscal
  FROM itemdocumentoestoque ide
  LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
  LEFT JOIN documentoestoque de ON ide.idDocumentoEstoque = de.id
  LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
  LEFT JOIN produto p ON p.id = ide.idProduto
  LEFT JOIN grupoproduto gp ON p.idGrupoProduto = gp.id
  LEFT JOIN familiaproduto fp ON p.idFamiliaProduto = fp.id
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
    AND (? = '' OR COALESCE(gp.nome, 'Outros') = ?)
  GROUP BY
    ide.id,
    ide.idProduto,
    p.nome,
    ip.id,
    pd.nome,
    DATE(de.dataEmissao),
    tm.nome,
    nfe.status,
    ide.qtde,
    ide.valorUnitario,
    COALESCE(gp.nome, 'Outros'),
    fp.nome,
    MONTH(de.dataEmissao),
    YEAR(de.dataEmissao),
    de.numeroDocumentoFiscal,
    IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco')
) base
WHERE base.idItemPedidoSM = 'So Moveis'
ORDER BY base.dataEmissao DESC, base.idItemDocumentoEstoque DESC
LIMIT ?
