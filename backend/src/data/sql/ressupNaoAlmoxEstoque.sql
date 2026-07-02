-- Estoque por setor para Ressup Não Almox: PA (explosão setor 5), setores 2 e 20 (saldo direto).
-- Parâmetro repetido 3x: idProduto (componente)
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
        ON lm.idProduto = us.idProduto AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
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
        ON lm.idProduto = e.idComponente AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
),

saldo_pa_explosao AS (
    SELECT ROUND(COALESCE(SUM(qtde), 0), 2) AS saldo
    FROM explosao_estoque
    WHERE idComponente = ?
),

saldo_setor_direto AS (
    SELECT
        se.id AS id_setor,
        se.nome AS nome_setor,
        CASE
            WHEN sp.saldoSetorFinal <= 0 THEN 0
            ELSE ROUND(sp.saldoSetorFinal, 2)
        END AS saldo
    FROM weberp_soaco.saldoestoque_produto sp
    INNER JOIN (
        SELECT idProduto, idSetorEstoque, MAX(dataMovimentacao) AS maxData
        FROM weberp_soaco.saldoestoque_produto
        WHERE idProduto = ?
          AND idEmpresa = 1
          AND idSetorEstoque IN (2, 20)
        GROUP BY idProduto, idSetorEstoque
    ) ult ON ult.idProduto = sp.idProduto
          AND ult.idSetorEstoque = sp.idSetorEstoque
          AND sp.dataMovimentacao = ult.maxData
    INNER JOIN weberp_soaco.setorestoque se ON se.id = sp.idSetorEstoque
    WHERE sp.idProduto = ?
      AND sp.idEmpresa = 1
      AND sp.idSetorEstoque IN (2, 20)
)

SELECT
    'PA' AS tipo,
    5 AS id_setor,
    'PRODUTOS ACABADOS (explosão BOM)' AS nome_setor,
    (SELECT saldo FROM saldo_pa_explosao) AS saldo

UNION ALL

SELECT
    'SETOR' AS tipo,
    sd.id_setor,
    sd.nome_setor,
    sd.saldo
FROM saldo_setor_direto sd
WHERE sd.saldo > 0

ORDER BY id_setor
