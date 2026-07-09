/* DRE — CPV Só Aço (Nomus): BOM + custo médio mensal.
   Placeholders: {{PSM_DATA_MIN}}, {{ID_EMPRESA}}, {{DATA_EMISSAO_MIN}}, {{DATA_EMISSAO_MAX}}, {{ID_EMPRESA_SAIDA}}
   Agregado: custoTotal por mes/ano/grupoProduto/idItemPedidoSM (So Aco / So Moveis). */WITH
base AS (
  SELECT
    ide.id,
    ide.idDocumentoEstoque,
    ide.idProduto,
    ide.idTipoMovimentacao,
    ide.qtde,
    CASE WHEN p.descricao LIKE '%GRAMPO%GRAMPEADO%PNEU%' THEN 0.01 ELSE ide.valorUnitario END AS valorUnitario,
    d.dataEntrada,
    p.descricao,
    p.nome
  FROM itemdocumentoestoque ide
  JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
  JOIN produto p ON p.id = ide.idProduto
  WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 142)
    AND ide.idSetorEntrada IN (2, 19, 20, 32)
    AND d.dataEntrada >= DATE('2016-01-01')
    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
),
norm AS (
  SELECT
    b.*,
    REPLACE(
      CASE
        WHEN UPPER(b.descricao) LIKE 'BOBINA%X%MM%' THEN
          CASE
            WHEN LENGTH(b.descricao) - LENGTH(REPLACE(UPPER(b.descricao), 'X', '')) = 1
              THEN CONCAT(TRIM(SUBSTRING_INDEX(UPPER(b.descricao), 'X', 1)),
                          SUBSTRING(UPPER(b.descricao), LOCATE('MM', UPPER(b.descricao)) + 2))
            ELSE CONCAT(LEFT(UPPER(b.descricao), LENGTH(SUBSTRING_INDEX(b.descricao, 'X', 2))),
                        SUBSTRING(UPPER(b.descricao), LOCATE('MM', UPPER(b.descricao)) + 2))
          END
        ELSE ''
      END,
      'BOBINA INTEIRA', 'BOBINA SLITADA'
    ) AS bobina
  FROM base b
),
cunit AS (
  SELECT
    n.idProduto,
    n.nome AS produto,
    n.bobina,
    n.valorUnitario AS valorUnitarioTotal,
    n.dataEntrada,
    n.qtde
  FROM norm n
),
last_by_bobina AS (
  SELECT
    REPLACE(
      CASE
        WHEN UPPER(descricao) LIKE 'BOBINA%X%MM%' THEN
          CASE
            WHEN LENGTH(descricao) - LENGTH(REPLACE(UPPER(descricao), 'X', '')) = 1
              THEN CONCAT(TRIM(SUBSTRING_INDEX(UPPER(descricao), 'X', 1)),
                          SUBSTRING(UPPER(descricao), LOCATE('MM', UPPER(descricao)) + 2))
            ELSE CONCAT(LEFT(UPPER(descricao), LENGTH(SUBSTRING_INDEX(descricao, 'X', 2))),
                        SUBSTRING(UPPER(descricao), LOCATE('MM', UPPER(descricao)) + 2))
          END
        ELSE ''
      END,
      'BOBINA INTEIRA', 'BOBINA SLITADA'
    ) AS bobina,
    MAX(dataEntrada) AS dataEntrada
  FROM base
  WHERE REPLACE(UPPER(descricao), 'INOX', 'INO') LIKE 'BOBINA%X%MM%'
    AND REPLACE(UPPER(descricao), 'INOX', 'INO') NOT LIKE '%ETIQUETA%'
  GROUP BY 1
),
bobin AS (
  SELECT DISTINCT
    n.bobina,
    n.valorUnitario AS valorUnitarioTotal
  FROM norm n
  JOIN last_by_bobina lb
    ON lb.bobina = n.bobina
   AND lb.dataEntrada = n.dataEntrada
),
escolhido AS (
  SELECT
    c.idProduto,
    c.produto,
    CASE
      WHEN c.bobina <> '' AND b.valorUnitarioTotal IS NOT NULL THEN b.valorUnitarioTotal
      ELSE c.valorUnitarioTotal
    END AS valorUnitario,
    c.dataEntrada,
    c.qtde
  FROM cunit c
  LEFT JOIN bobin b ON b.bobina = c.bobina
),
custo AS (
  SELECT
    e.idProduto,
    DATE(CONCAT(EXTRACT(YEAR FROM e.dataEntrada), '-', LPAD(EXTRACT(MONTH FROM e.dataEntrada), 2, '0'), '-01')) AS periodo,
    EXTRACT(YEAR FROM e.dataEntrada) AS ano,
    EXTRACT(MONTH FROM e.dataEntrada) AS mes,
    ROUND(SUM(e.qtde * e.valorUnitario) / NULLIF(SUM(e.qtde), 0), 5) AS custo_medio_mensal,
    SUM(e.qtde) AS qtde_total_mes
  FROM escolhido e
  GROUP BY e.idProduto, periodo, ano, mes
  HAVING ano IS NOT NULL AND mes IS NOT NULL
),
fat AS (
  SELECT
    ide.idProduto,
    p.nome AS produto,
    IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco') AS idItemPedidoSM,
    EXTRACT(MONTH FROM de.dataEmissao) AS mes,
    EXTRACT(YEAR FROM de.dataEmissao) AS ano,
    SUM(ide.qtde) AS qtd_total
  FROM itemdocumentoestoque ide
  JOIN documentoestoque de ON de.id = ide.idDocumentoEstoque
  JOIN tipomovimentacao tm ON tm.id = ide.idTipoMovimentacao
  JOIN produto p ON p.id = ide.idProduto
  LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv ON ideipv.idItemDocumentoEstoque = ide.id
  LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
  LEFT JOIN pedido pd ON pd.id = ip.idPedido
  LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
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
    WHERE pd.dataEmissao >= '{{PSM_DATA_MIN}}'
      AND pd.idEmpresa = {{ID_EMPRESA}}
      AND vor.idListaOpcao = 2377
      AND req.opcao <> 'Sim'
  ) psm ON psm.idItemPedido = ip.id
  WHERE (nfe.status IS NULL OR nfe.status IN (1, 3, 4))
    AND tm.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 64, 92)
    AND DATE(de.dataEmissao) BETWEEN '{{DATA_EMISSAO_MIN}}' AND '{{DATA_EMISSAO_MAX}}'
    AND de.idEmpresaSaida = {{ID_EMPRESA_SAIDA}}    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
    AND de.numeroDocumentoFiscal NOT IN (
      128748, 127108, 133953, 133950, 133948, 133947, 133956, 133951,
      133949, 133957, 133961, 133876
    )
  GROUP BY ide.idProduto, IF(psm.idItemPedido IS NOT NULL, 'So Moveis', 'So Aco'), p.nome, mes, ano
),
attr540 AS (
  SELECT apv.idProduto, alo.opcao
  FROM atributoprodutovalor apv
  JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
  WHERE apv.idAtributo = 540
),
ft AS (
  SELECT
    pq.idProduto AS idprodutopai,
    pp.nome AS codigopai,
    pp.descricao AS descricaopai,
    pp.idGrupoProduto AS idGrupoProd,
    COALESCE(pf5.id, pf4.id, pf3.id, pf2.id, pf1.id) AS idcomponente,
    COALESCE(pf5.nome, pf4.nome, pf3.nome, pf2.nome, pf1.nome) AS codigocomponente,
    COALESCE(pf5.descricao, pf4.descricao, pf3.descricao, pf2.descricao, pf1.descricao) AS componente,
    (
      COALESCE(CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
      COALESCE(CAST(REPLACE(pq2.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
      COALESCE(CAST(REPLACE(pq3.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
      COALESCE(CAST(REPLACE(pq4.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
      COALESCE(CAST(REPLACE(pq5.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1)
    ) AS qtd_total
  FROM produtoqtde pq
  JOIN produto pp ON pp.id = pq.idProduto
  JOIN listamateriais lm ON lm.id = pq.idListaMateriais
  LEFT JOIN produto pf1 ON pf1.id = pq.idProdutoComponente
  LEFT JOIN produtoqtde pq2 ON pq2.idProduto = pq.idProdutoComponente
  LEFT JOIN listamateriais lm2 ON lm2.id = pq2.idListaMateriais
  LEFT JOIN produto pf2 ON pf2.id = pq2.idProdutoComponente
  LEFT JOIN produtoqtde pq3 ON pq3.idProduto = pq2.idProdutoComponente
  LEFT JOIN listamateriais lm3 ON lm3.id = pq3.idListaMateriais
  LEFT JOIN produto pf3 ON pf3.id = pq3.idProdutoComponente
  LEFT JOIN produtoqtde pq4 ON pq4.idProduto = pq3.idProdutoComponente
  LEFT JOIN listamateriais lm4 ON lm4.id = pq4.idListaMateriais
  LEFT JOIN produto pf4 ON pf4.id = pq4.idProdutoComponente
  LEFT JOIN produtoqtde pq5 ON pq5.idProduto = pq4.idProdutoComponente
  LEFT JOIN listamateriais lm5 ON lm5.id = pq5.idListaMateriais
  LEFT JOIN produto pf5 ON pf5.id = pq5.idProdutoComponente
  WHERE (lm.descricao LIKE 'Lista%Produ__o' OR lm.descricao LIKE 'Lista%Precifica__o')
    AND lm.padrao = 1
    AND pp.idTipoProduto IN (8, 15)
    AND COALESCE(lm.ativo, 1) = 1
    AND COALESCE(lm.padrao, 1) = 1
    AND COALESCE(lm.discriminador, 'Original') = 'Original'
    AND COALESCE(lm2.ativo, 1) = 1
    AND COALESCE(lm2.padrao, 1) = 1
    AND COALESCE(lm2.discriminador, 'Original') = 'Original'
    AND COALESCE(lm3.ativo, 1) = 1
    AND COALESCE(lm3.padrao, 1) = 1
    AND COALESCE(lm3.discriminador, 'Original') = 'Original'
    AND COALESCE(lm4.ativo, 1) = 1
    AND COALESCE(lm4.padrao, 1) = 1
    AND COALESCE(lm4.discriminador, 'Original') = 'Original'
    AND COALESCE(lm5.ativo, 1) = 1
    AND COALESCE(lm5.padrao, 1) = 1
    AND COALESCE(lm5.discriminador, 'Original') = 'Original'
),
detalhe AS (
SELECT
  f.mes,
  f.ano,
  gp.nome AS grupoProduto,
  f.idItemPedidoSM,
  (
    SELECT c.custo_medio_mensal
    FROM custo c
    WHERE c.idProduto = ft.idcomponente
    ORDER BY
      CASE WHEN c.periodo <= DATE(CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01')) THEN 0 ELSE 1 END,
      ABS(DATEDIFF(c.periodo, DATE(CONCAT(f.ano, '-', LPAD(f.mes, 2, '0'), '-01')))),
      c.periodo DESC
    LIMIT 1
  ) * ROUND(f.qtd_total * ft.qtd_total, 5) AS custototal
FROM fat f
JOIN ft ON ft.idprodutopai = f.idProduto
LEFT JOIN grupoproduto gp ON gp.id = ft.idGrupoProd
WHERE ft.idcomponente NOT IN (14272, 1393, 32962, 32963)
  AND f.idItemPedidoSM IN ('So Aco', 'So Moveis')
)
SELECT
  d.mes,
  d.ano,
  d.grupoProduto,
  d.idItemPedidoSM,
  SUM(d.custototal) AS custoTotal
FROM detalhe d
WHERE d.custototal IS NOT NULL
GROUP BY d.mes, d.ano, d.grupoProduto, d.idItemPedidoSM
