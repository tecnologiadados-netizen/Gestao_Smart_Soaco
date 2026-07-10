WITH movimento_liquido AS (
  SELECT
    ide.idItemPedidoVenda AS idItemPedido,
    SUM(
      CASE
        WHEN tm.id IN (6, 21, 27, 45, 54, 59, 62, 64, 74, 83, 92, 93, 108) THEN ide.qtde
        WHEN tm.id IN (52, 55) THEN -ide.qtde
        ELSE 0
      END
    ) AS qtdeLiquida
  FROM itemdocumentoestoque_itempedidovenda ide
  JOIN itemdocumentoestoque idoc ON idoc.id = ide.idItemDocumentoEstoque
  JOIN documentoestoque de ON de.id = idoc.idDocumentoEstoque
  JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
  WHERE NOT EXISTS (
    SELECT 1
    FROM nfe n
    WHERE n.idDocumentoEstoque = de.id
      AND n.dataHoraCancelamento IS NOT NULL
  )
  GROUP BY ide.idItemPedidoVenda
),
item_ajustado AS (
  SELECT
    ip.id,
    ip.idPedido,
    ip.idProduto,
    CASE
      WHEN ip.status = 5 AND ip.encerrado = 1 THEN COALESCE(ml.qtdeLiquida, 0)
      ELSE ip.qtde
    END AS qtdeAjustada,
    CASE
      WHEN ip.status = 5 AND ip.encerrado = 1 THEN COALESCE(ml.qtdeLiquida, 0) * (ip.valorTotalComDesconto / NULLIF(ip.qtde, 0))
      ELSE ip.valorTotalComDesconto
    END AS valorAjustado
  FROM itempedido ip
  LEFT JOIN movimento_liquido ml ON ml.idItemPedido = ip.id
)
SELECT
  p.id AS pdId,
  p.nome AS pdCodigo,
  DATE(p.dataEmissao) AS dataEmissao,
  DATE_FORMAT(p.dataEmissao, '%Y-%m') AS mes,
  COALESCE(pec.nomeRazaoSocial, pec.nome, '—') AS cliente,
  COALESCE(vr.nome, '—') AS vendedor,
  COALESCE(m.UF, pec.uf, '—') AS uf,
  COALESCE(m.nome, '—') AS municipio,
  IF(m.nome IN ('Teresina', 'Altos', 'Alto Longá', 'Timon', 'Nazária', 'Demerval Lobão'), 'Grande THE', 'Outras regiões') AS regiao,
  pr.nome AS codigoProduto,
  pr.descricao AS descricaoProduto,
  gp.nome AS grupoProduto,
  alo1.opcao AS subgrupo1,
  alo2.opcao AS subgrupo2,
  ia.qtdeAjustada AS qtdeVendida,
  ia.valorAjustado AS valorVendido
FROM item_ajustado ia
JOIN pedido p ON p.id = ia.idPedido
JOIN produto pr ON pr.id = ia.idProduto
LEFT JOIN grupoproduto gp ON gp.id = pr.idGrupoProduto
LEFT JOIN atributoprodutovalor apv1 ON apv1.idProduto = pr.id AND apv1.idAtributo = 398
LEFT JOIN atributolistaopcao alo1 ON alo1.id = apv1.idListaOpcao
LEFT JOIN atributoprodutovalor apv2 ON apv2.idProduto = pr.id AND apv2.idAtributo = 399
LEFT JOIN atributolistaopcao alo2 ON alo2.id = apv2.idListaOpcao
LEFT JOIN pessoa pec ON pec.id = p.idCliente
LEFT JOIN pessoa vr ON vr.id = COALESCE(p.idVendedor, p.idRepresentante)
LEFT JOIN municipio m ON m.id = pec.idMunicipio
WHERE p.idEmpresa = 1
  AND DATE(p.dataEmissao) >= '__DATA_INI__'
  AND DATE(p.dataEmissao) <= '__DATA_FIM__'
  AND NOT EXISTS (
    SELECT 1
    FROM atributopedidovalor apv
    JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
    WHERE apv.idPedido = p.id
      AND apv.idAtributo = 313
      AND alo.opcao = 'Sim'
  )
;
