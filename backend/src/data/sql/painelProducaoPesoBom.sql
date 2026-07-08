-- PESO BOM por produto (Power BI sql/produto.sql)
SELECT idprodutopai AS id_produto, SUM(qtd) AS peso
FROM (

    SELECT
        ft.idprodutopai,
        ft.codigopai,
        ft.descricaopai,
        SUM(ROUND((ft.qtd1 * ft.qtd2 * ft.qtd3 * ft.qtd4 * ft.qtd5), 5)) AS qtd,
        COALESCE(t.opcao, 'Material Secundário') AS tipomaterial
    FROM (
        SELECT
            pq.idProduto AS idprodutopai,
            pp.nome AS codigopai,
            pp.descricao AS descricaopai,
            pf1.id AS idcomponente1,
            pf1.nome AS codigocomponente1,
            pf1.descricao AS descricaocomponente1,
            tp1.nome AS tipoproduto1,
            COALESCE(CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) AS qtd1,
            pfl1.id AS perfiladeira1,
            tm1.opcao AS tipomaterial1,
            pf2.id AS idcomponente2,
            pf2.nome AS codigocomponente2,
            pf2.descricao AS descricaocomponente2,
            tp2.nome AS tipoproduto2,
            COALESCE(CAST(REPLACE(pq2.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) AS qtd2,
            pfl2.id AS perfiladeira2,
            tm2.opcao AS tipomaterial2,
            pf3.id AS idcomponente3,
            pf3.nome AS codigocomponente3,
            pf3.descricao AS descricaocomponente3,
            tp3.nome AS tipoproduto3,
            COALESCE(CAST(REPLACE(pq3.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) AS qtd3,
            pfl3.id AS perfiladeira3,
            tm3.opcao AS tipomaterial3,
            pf4.id AS idcomponente4,
            pf4.nome AS codigocomponente4,
            pf4.descricao AS descricaocomponente4,
            tp4.nome AS tipoproduto4,
            COALESCE(CAST(REPLACE(pq4.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) AS qtd4,
            pfl4.id AS perfiladeira4,
            tm4.opcao AS tipomaterial4,
            pf5.id AS idcomponente5,
            pf5.nome AS codigocomponente5,
            pf5.descricao AS descricaocomponente5,
            tp5.nome AS tipoproduto5,
            COALESCE(CAST(REPLACE(pq5.qtdeNecessaria, ',', '.') AS DECIMAL(10, 5)), 1) AS qtd5,
            pfl5.id AS perfiladeira5,
            tm5.opcao AS tipomaterial5
        FROM produtoqtde pq
        LEFT JOIN produto pp ON pq.idProduto = pp.id
        LEFT JOIN listamateriais lm ON lm.id = pq.idListaMateriais
        LEFT JOIN produto pf1 ON pq.idProdutoComponente = pf1.id
        LEFT JOIN tipoproduto tp1 ON tp1.id = pf1.idTipoProduto
        LEFT JOIN (
            SELECT DISTINCT p.id
            FROM roteiroproduto r
            LEFT JOIN produto p ON p.id = r.idProduto
            LEFT JOIN operacaoroteiroproduto o ON o.idRoteiroProduto = r.id
            LEFT JOIN recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
            LEFT JOIN recurso re ON re.id = rhrp.idRecurso
            LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
            WHERE r.ativo = 1
              AND (tp.nome = 'Produto em processo' OR tp.nome = 'Produto intermediário')
              AND p.ativo = 1
              AND re.id IN (1, 4, 46, 124, 123)
        ) pfl1 ON pfl1.id = pf1.id
        LEFT JOIN (
            SELECT apv.idProduto, alo.opcao
            FROM atributoprodutovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 540
        ) tm1 ON tm1.idProduto = pf1.id
        LEFT JOIN produtoqtde pq2 ON pq.idProdutoComponente = pq2.idProduto
        LEFT JOIN listamateriais lm2 ON lm2.id = pq2.idListaMateriais
        LEFT JOIN produto pf2 ON pq2.idProdutoComponente = pf2.id
        LEFT JOIN tipoproduto tp2 ON tp2.id = pf2.idTipoProduto
        LEFT JOIN (
            SELECT DISTINCT p.id
            FROM roteiroproduto r
            LEFT JOIN produto p ON p.id = r.idProduto
            LEFT JOIN operacaoroteiroproduto o ON o.idRoteiroProduto = r.id
            LEFT JOIN recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
            LEFT JOIN recurso re ON re.id = rhrp.idRecurso
            LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
            WHERE r.ativo = 1
              AND (tp.nome = 'Produto em processo' OR tp.nome = 'Produto intermediário')
              AND p.ativo = 1
              AND re.id IN (1, 4, 46, 124, 123)
        ) pfl2 ON pfl2.id = pf2.id
        LEFT JOIN (
            SELECT apv.idProduto, alo.opcao
            FROM atributoprodutovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 540
        ) tm2 ON tm2.idProduto = pf2.id
        LEFT JOIN produtoqtde pq3 ON pq2.idProdutoComponente = pq3.idProduto
        LEFT JOIN listamateriais lm3 ON lm3.id = pq3.idListaMateriais
        LEFT JOIN produto pf3 ON pq3.idProdutoComponente = pf3.id
        LEFT JOIN tipoproduto tp3 ON tp3.id = pf3.idTipoProduto
        LEFT JOIN (
            SELECT DISTINCT p.id
            FROM roteiroproduto r
            LEFT JOIN produto p ON p.id = r.idProduto
            LEFT JOIN operacaoroteiroproduto o ON o.idRoteiroProduto = r.id
            LEFT JOIN recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
            LEFT JOIN recurso re ON re.id = rhrp.idRecurso
            LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
            WHERE r.ativo = 1
              AND (tp.nome = 'Produto em processo' OR tp.nome = 'Produto intermediário')
              AND p.ativo = 1
              AND re.id IN (1, 4, 46, 124, 123)
        ) pfl3 ON pfl3.id = pf3.id
        LEFT JOIN (
            SELECT apv.idProduto, alo.opcao
            FROM atributoprodutovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 540
        ) tm3 ON tm3.idProduto = pf3.id
        LEFT JOIN produtoqtde pq4 ON pq3.idProdutoComponente = pq4.idProduto
        LEFT JOIN listamateriais lm4 ON lm4.id = pq4.idListaMateriais
        LEFT JOIN produto pf4 ON pq4.idProdutoComponente = pf4.id
        LEFT JOIN tipoproduto tp4 ON tp4.id = pf4.idTipoProduto
        LEFT JOIN (
            SELECT DISTINCT p.id
            FROM roteiroproduto r
            LEFT JOIN produto p ON p.id = r.idProduto
            LEFT JOIN operacaoroteiroproduto o ON o.idRoteiroProduto = r.id
            LEFT JOIN recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
            LEFT JOIN recurso re ON re.id = rhrp.idRecurso
            LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
            WHERE r.ativo = 1
              AND (tp.nome = 'Produto em processo' OR tp.nome = 'Produto intermediário')
              AND p.ativo = 1
              AND re.id IN (1, 4, 46, 124, 123)
        ) pfl4 ON pfl4.id = pf4.id
        LEFT JOIN (
            SELECT apv.idProduto, alo.opcao
            FROM atributoprodutovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 540
        ) tm4 ON tm4.idProduto = pf4.id
        LEFT JOIN produtoqtde pq5 ON pq4.idProdutoComponente = pq5.idProduto
        LEFT JOIN listamateriais lm5 ON lm5.id = pq5.idListaMateriais
        LEFT JOIN produto pf5 ON pq5.idProdutoComponente = pf5.id
        LEFT JOIN tipoproduto tp5 ON tp5.id = pf5.idTipoProduto
        LEFT JOIN (
            SELECT DISTINCT p.id
            FROM roteiroproduto r
            LEFT JOIN produto p ON p.id = r.idProduto
            LEFT JOIN operacaoroteiroproduto o ON o.idRoteiroProduto = r.id
            LEFT JOIN recursohabilitadoroteiroproduto rhrp ON rhrp.idOperacaoRoteiroProduto = o.id
            LEFT JOIN recurso re ON re.id = rhrp.idRecurso
            LEFT JOIN tipoproduto tp ON tp.id = p.idTipoProduto
            WHERE r.ativo = 1
              AND (tp.nome = 'Produto em processo' OR tp.nome = 'Produto intermediário')
              AND p.ativo = 1
              AND re.id IN (1, 4, 46, 124, 123)
        ) pfl5 ON pfl5.id = pf5.id
        LEFT JOIN (
            SELECT apv.idProduto, alo.opcao
            FROM atributoprodutovalor apv
            LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
            WHERE apv.idAtributo = 540
        ) tm5 ON tm5.idProduto = pf5.id
        WHERE pp.idTipoProduto IN (8, 15)
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
          AND pp.ativo = 1
          AND (
              CASE
                  WHEN tp1.nome IS NOT NULL OR tp1.nome IS NULL THEN 1
                  WHEN (
                      (pfl1.id IS NULL AND (tp1.nome = 'Produto em processo' OR tp1.nome = 'Produto intermediário'))
                      AND (
                          (pf2.id IS NOT NULL AND (tp2.nome = 'Produto em processo' OR tp2.nome = 'Produto intermediário'))
                          OR (pf3.id IS NOT NULL AND (tp3.nome = 'Produto em processo' OR tp3.nome = 'Produto intermediário'))
                          OR (pf4.id IS NOT NULL AND (tp2.nome = 'Produto em processo' OR tp4.nome = 'Produto intermediário'))
                          OR (pf5.id IS NOT NULL AND (tp2.nome = 'Produto em processo' OR tp5.nome = 'Produto intermediário'))
                      )
                  ) THEN 1
                  ELSE 0
              END
          ) = 1
    ) ft
    LEFT JOIN produto pum ON pum.id = COALESCE(
        COALESCE(COALESCE(COALESCE(ft.idcomponente5, ft.idcomponente4), ft.idcomponente3), ft.idcomponente2),
        ft.idcomponente1
    )
    LEFT JOIN produto pac ON pac.id = ft.idprodutopai
    LEFT JOIN unidademedida u ON u.id = pum.idUnidadeMedida
    LEFT JOIN grupoproduto gp ON gp.id = pac.idGrupoProduto
    LEFT JOIN (
        SELECT apv.idProduto, alo.opcao
        FROM atributoprodutovalor apv
        LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
        WHERE apv.idAtributo = 540
    ) t ON (
        COALESCE(
            COALESCE(COALESCE(COALESCE(ft.idcomponente5, ft.idcomponente4), ft.idcomponente3), ft.idcomponente2),
            ft.idcomponente1
        )
    ) = t.idProduto
    WHERE COALESCE(t.opcao, 'Material Secundário') = 'Matéria Prima'
      AND gp.id IN (58, 101, 122, 123, 124, 125, 126, 127, 128, 129, 130, 64)
    GROUP BY
        ft.idprodutopai,
        ft.codigopai,
        ft.descricaopai,
        COALESCE(t.opcao, 'Material Secundário')
    ORDER BY ft.idprodutopai ASC

) bom
GROUP BY idprodutopai
