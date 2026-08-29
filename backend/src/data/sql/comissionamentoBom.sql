/* BOM flat (até 5 níveis) — mesmo critério do CPV DRE Só Aço, sem faturamento/MKP.
   Retorna: idProdutoPai, idComponente, qtdTotal */
SELECT
  pq.idProduto AS idProdutoPai,
  COALESCE(pf5.id, pf4.id, pf3.id, pf2.id, pf1.id) AS idComponente,
  (
    COALESCE(CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
    COALESCE(CAST(REPLACE(pq2.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
    COALESCE(CAST(REPLACE(pq3.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
    COALESCE(CAST(REPLACE(pq4.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) *
    COALESCE(CAST(REPLACE(pq5.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1)
  ) AS qtdTotal
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
  AND COALESCE(pf5.id, pf4.id, pf3.id, pf2.id, pf1.id) IS NOT NULL
  AND COALESCE(pf5.id, pf4.id, pf3.id, pf2.id, pf1.id) NOT IN (14272, 1393, 32962, 32963)
;
