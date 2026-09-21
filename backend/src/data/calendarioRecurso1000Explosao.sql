-- Explosão multinível PA → componentes do Recurso 1000 (Perfiladeira, recurso Nomus 124).
-- Mesma lista padrão da programação de produção (Produção / Precificação / Parcial).
-- Placeholder `__IDS__` = IDs dos produtos acabados da demanda do calendário.

WITH RECURSIVE produtos_recurso_124 AS (
    SELECT DISTINCT
        p.id                            AS idProduto,
        p.nome                          AS codigo_produto,
        p.descricao                     AS descricao_produto
    FROM weberp_soaco.roteiroproduto r
    INNER JOIN weberp_soaco.produto p                            ON p.id = r.idProduto
    INNER JOIN weberp_soaco.operacaoroteiroproduto o             ON o.idRoteiroProduto = r.id
    INNER JOIN weberp_soaco.recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
    INNER JOIN weberp_soaco.recurso re                           ON re.id = rhrp.idRecurso
    WHERE r.ativo = 1
      AND p.ativo = 1
      AND p.idRoteiroProdutoPadrao = r.id
      AND re.id = 124
),

pas AS (
    SELECT p.id AS idProduto, p.nome AS codigo
    FROM weberp_soaco.produto p
    WHERE p.ativo = 1
      AND p.id IN (__IDS__)
),

explosao AS (
    SELECT
        pas.idProduto                   AS idProdutoOrigem,
        pas.idProduto                   AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtdePorPa,
        0                               AS nivel
    FROM pas
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = pas.idProduto AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id

    UNION ALL

    SELECT
        e.idProdutoOrigem,
        e.idComponente                  AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        e.qtdePorPa * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtdePorPa,
        e.nivel + 1
    FROM explosao e
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
    WHERE e.nivel < 12
)

SELECT
    e.idProdutoOrigem                   AS id_pa,
    pa.codigo                           AS codigo_pa,
    pr.idProduto                        AS id_componente,
    pr.codigo_produto                   AS cod_componente,
    pr.descricao_produto                AS descricao_componente,
    SUM(e.qtdePorPa)                    AS qtde_por_pa
FROM explosao e
INNER JOIN produtos_recurso_124 pr ON pr.idProduto = e.idComponente
INNER JOIN pas pa ON pa.idProduto = e.idProdutoOrigem
WHERE e.qtdePorPa > 0
GROUP BY e.idProdutoOrigem, pa.codigo, pr.idProduto, pr.codigo_produto, pr.descricao_produto

UNION ALL

SELECT
    pas.idProduto                       AS id_pa,
    pas.codigo                          AS codigo_pa,
    pr.idProduto                        AS id_componente,
    pr.codigo_produto                   AS cod_componente,
    pr.descricao_produto                AS descricao_componente,
    1                                   AS qtde_por_pa
FROM pas
INNER JOIN produtos_recurso_124 pr ON pr.idProduto = pas.idProduto
;
