-- VM (venda média móvel 6 meses) por componente — listas validadas, mesmo critério da programação de produção.
WITH RECURSIVE explosao_venda AS (
    SELECT
        ip.idProduto                    AS idProdutoOrigem,
        ip.idProduto                    AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        SUM(ip.qtde) / 6
            * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS media_mensal
    FROM weberp_soaco.itempedido ip
    INNER JOIN weberp_soaco.pedido pd ON pd.id = ip.idPedido
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = ip.idProduto AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
    LEFT JOIN (
        SELECT apv.idPedido, alo.opcao
        FROM weberp_soaco.atributopedidovalor apv
        LEFT JOIN weberp_soaco.atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 313
    ) requisicao ON requisicao.idPedido = pd.id
    WHERE pd.idEmpresa = 1
      AND ip.status IN (2, 3, 4, 5)
      AND pd.dataEmissao >= DATE(CONCAT(
            EXTRACT(YEAR FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-',
            EXTRACT(MONTH FROM DATE_ADD(CURDATE(), INTERVAL -6 MONTH)), '-', 1))
      AND pd.dataEmissao <= LAST_DAY(DATE_ADD(CURDATE(), INTERVAL -1 MONTH))
      AND (requisicao.opcao IS NULL OR requisicao.opcao != 'Sim')
    GROUP BY ip.idProduto, pq.idProdutoComponente, pq.qtdeNecessaria

    UNION ALL

    SELECT
        e.idProdutoOrigem,
        e.idComponente                  AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        e.media_mensal
            * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS media_mensal
    FROM explosao_venda e
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1 AND lm.ativo = 1 AND lm.discriminador = 'Original'
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
)

SELECT
    idComponente AS idProduto,
    ROUND(SUM(media_mensal), 2) AS VM
FROM explosao_venda
GROUP BY idComponente
