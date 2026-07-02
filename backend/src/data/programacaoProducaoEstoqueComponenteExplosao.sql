-- Origem PA (setor 5) na explosão de estoque para um componente.
WITH RECURSIVE ultimo_saldo_pa AS (
    SELECT
        sp.idProduto,
        sp.saldoSetorFinal
    FROM weberp_soaco.saldoestoque_produto sp
    INNER JOIN (
        SELECT idProduto, MAX(dataMovimentacao) AS maxData
        FROM weberp_soaco.saldoestoque_produto
        WHERE idSetorEstoque = 5
          AND idEmpresa = 1
        GROUP BY idProduto
    ) ult ON ult.idProduto = sp.idProduto
          AND sp.dataMovimentacao = ult.maxData
    WHERE sp.idSetorEstoque = 5
      AND sp.idEmpresa = 1
),

explosao_estoque AS (
    SELECT
        us.idProduto                    AS idProdutoOrigem,
        us.idProduto                    AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        us.saldoSetorFinal
            * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM ultimo_saldo_pa us
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = us.idProduto AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
    WHERE us.saldoSetorFinal > 0

    UNION ALL

    SELECT
        e.idProdutoOrigem,
        e.idComponente                  AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        e.qtde * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM explosao_estoque e
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
)

SELECT
    p.nome AS cod_pa,
    p.descricao AS descricao_pa,
    ROUND(SUM(e.qtde), 2) AS qtde_alocada
FROM explosao_estoque e
INNER JOIN weberp_soaco.produto p ON p.id = e.idProdutoOrigem
WHERE e.idComponente = ?
GROUP BY e.idProdutoOrigem, p.nome, p.descricao
HAVING SUM(e.qtde) > 0
ORDER BY p.nome
