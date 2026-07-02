WITH RECURSIVE

devolucoes AS (
    SELECT
        ip.id                           AS idItemPedido,
        SUM(ide.qtde)                   AS qtdDevolvida
    FROM weberp_soaco.itemdocumentoestoque ide
    INNER JOIN weberp_soaco.itemdocumentoestoque_itempedidovenda ideipv
        ON ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao
    INNER JOIN weberp_soaco.itempedido ip            ON ip.id = ideipv.idItemPedidoVenda
    INNER JOIN weberp_soaco.documentoestoque de      ON de.id = ide.idDocumentoEntrada
    INNER JOIN weberp_soaco.tipomovimentacao tm      ON tm.id = ide.idTipoMovimentacao
    WHERE tm.id IN (52, 55)
      AND ide.idItemOrigemDevolucao IS NOT NULL
      AND ip.status IN (2, 3)
    GROUP BY ip.id
),

produtos_recurso_124 AS (
    SELECT DISTINCT
        p.id                            AS idProduto,
        p.nome                          AS codigo_produto,
        p.descricao                     AS descricao_produto,
        tp.nome                         AS tipo_produto
    FROM weberp_soaco.roteiroproduto r
    INNER JOIN weberp_soaco.produto p                            ON p.id = r.idProduto
    INNER JOIN weberp_soaco.tipoproduto tp                       ON tp.id = p.idTipoProduto
    INNER JOIN weberp_soaco.operacaoroteiroproduto o             ON o.idRoteiroProduto = r.id
    INNER JOIN weberp_soaco.recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
    INNER JOIN weberp_soaco.recurso re                           ON re.id = rhrp.idRecurso
    WHERE r.ativo = 1
      AND p.ativo = 1
      AND p.idRoteiroProdutoPadrao = r.id
      AND re.id = 124
),

bobina_componente AS (
    SELECT
        pp.id                           AS idComponente,
        pc.id                           AS idBobina,
        pc.nome                         AS codigo_bobina,
        pc.descricao                    AS descricao_bobina,
        CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS kg_por_unidade
    FROM weberp_soaco.produto pp
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = pp.id
        AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
    INNER JOIN weberp_soaco.produto pc
        ON pc.id = pq.idProdutoComponente
    INNER JOIN weberp_soaco.tipoproduto tp
        ON tp.id = pc.idTipoProduto
    WHERE tp.id = 16
      AND pc.idFamiliaProduto = 65
),

bobinas_distintas AS (
    SELECT DISTINCT idBobina FROM bobina_componente
),

saldo_bobinas AS (
    SELECT
        b.idBobina AS idProduto,
        SUM(
            GREATEST(IFNULL((
                SELECT sep.saldoSetorFinal
                FROM weberp_soaco.saldoestoque_produto sep
                WHERE sep.id = (
                    SELECT MAX(sp.id)
                    FROM weberp_soaco.saldoestoque_produto sp
                    WHERE sp.idSetorEstoque = se.id
                      AND sp.idProduto = b.idBobina
                      AND sp.idEmpresa = 1
                )
            ), 0), 0)
        ) AS saldo_total
    FROM bobinas_distintas b
    CROSS JOIN weberp_soaco.setorestoque se
    WHERE se.id IN (19, 20)
    GROUP BY b.idBobina
),

ultimo_saldo_pa AS (
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
),

saldo_componentes AS (
    SELECT idComponente, SUM(qtde) AS saldo_estoque
    FROM explosao_estoque
    GROUP BY idComponente
),

explosao_empenho AS (
    SELECT
        ip.id                           AS idItemPedido,
        ip.idProduto                    AS idProdutoOrigem,
        ip.idProduto                    AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        ((ip.qtde - ip.qtdeAtendida) + COALESCE(dev.qtdDevolvida, 0.0))
            * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM weberp_soaco.itempedido ip
    INNER JOIN weberp_soaco.pedido pd ON pd.id = ip.idPedido
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = ip.idProduto AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
    LEFT JOIN devolucoes dev ON dev.idItemPedido = ip.id
    WHERE pd.idEmpresa = 1
      AND ip.status IN (2, 3)
      AND ((ip.qtde - ip.qtdeAtendida) + COALESCE(dev.qtdDevolvida, 0.0)) > 0

    UNION ALL

    SELECT
        e.idItemPedido,
        e.idProdutoOrigem,
        e.idComponente                  AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        e.qtde * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS qtde
    FROM explosao_empenho e
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = e.idComponente AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
),

empenho_componentes AS (
    SELECT idComponente, SUM(qtde) AS empenho_total
    FROM explosao_empenho
    GROUP BY idComponente
),

explosao_venda AS (
    SELECT
        ip.idProduto                    AS idProdutoOrigem,
        ip.idProduto                    AS idProdutoPai,
        pq.idProdutoComponente          AS idComponente,
        SUM(ip.qtde) / 6
            * CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS media_mensal
    FROM weberp_soaco.itempedido ip
    INNER JOIN weberp_soaco.pedido pd ON pd.id = ip.idPedido
    INNER JOIN weberp_soaco.listamateriais lm
        ON lm.idProduto = ip.idProduto AND lm.padrao = 1
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
        ON lm.idProduto = e.idComponente AND lm.padrao = 1
        AND (lm.descricao LIKE 'Lista%Produ__o'
          OR lm.descricao LIKE 'Lista%Precifica__o'
          OR lm.descricao LIKE 'Lista%Parci%')
    INNER JOIN weberp_soaco.produtoqtde pq
        ON pq.idListaMateriais = lm.id
),

venda_componentes AS (
    SELECT idComponente, SUM(media_mensal) AS media_mensal
    FROM explosao_venda
    GROUP BY idComponente
)

SELECT
    pr.idProduto                                                            AS id_componente,
    pr.codigo_produto                                                       AS cod_componente,
    pr.descricao_produto                                                    AS descricao_componente,
    ROUND(COALESCE(sc.saldo_estoque, 0), 2)                                AS estoque_atual_componente,
    bc.kg_por_unidade                                                       AS peso_unitario_bobina,
    bc.idBobina                                                             AS id_bobina,
    bc.codigo_bobina                                                        AS cod_bobina,
    bc.descricao_bobina                                                     AS descricao_bobina,
    ROUND(COALESCE(sb.saldo_total, 0), 2)                                   AS estoque_atual_bobina,
    ROUND(COALESCE(vc.media_mensal, 0), 2)                                  AS venda_media_componente,
    ROUND(COALESCE(ec.empenho_total, 0), 2)                                 AS empenho_componente,
    ROUND(COALESCE(sc.saldo_estoque, 0) - COALESCE(ec.empenho_total, 0), 2) AS saldo_projetado,
    CASE
        WHEN COALESCE(vc.media_mensal, 0) = 0 THEN NULL
        ELSE ROUND(
            (COALESCE(sc.saldo_estoque, 0) - COALESCE(ec.empenho_total, 0))
            / vc.media_mensal, 2)
    END                                                                     AS cobertura_meses,
    ROUND(
        GREATEST(COALESCE(ec.empenho_total, 0) - COALESCE(sc.saldo_estoque, 0), 0)
        * bc.kg_por_unidade, 2)                                             AS kg_bobina_necessario
FROM produtos_recurso_124 pr
LEFT JOIN saldo_componentes sc      ON sc.idComponente = pr.idProduto
LEFT JOIN empenho_componentes ec    ON ec.idComponente = pr.idProduto
LEFT JOIN venda_componentes vc      ON vc.idComponente = pr.idProduto
LEFT JOIN bobina_componente bc      ON bc.idComponente = pr.idProduto
LEFT JOIN saldo_bobinas sb          ON sb.idProduto = bc.idBobina
ORDER BY pr.codigo_produto
