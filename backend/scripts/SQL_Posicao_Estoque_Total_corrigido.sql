-- =============================================================================
-- SQL_Posição_Estoque_Total.xlsx — queries corrigidas (Nomus)
-- DSN Power Query: NOMUS_64X
--
-- Causa: Nomus deixou ide.idDocumentoEntrada / ide.idDocumentoSaida sempre NULL.
--        O vínculo correto passou a ser ide.idDocumentoEstoque.
-- Validado em 28/07/2026: JOIN antigo → 0 datas; JOIN novo → ~44k datas.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Consulta1 → aba SQL_Informação (saldos por setor) — sem alteração necessária
-- -----------------------------------------------------------------------------
SELECT
    ultimos_saldos.idProduto,
    ultimos_saldos.cod AS Codigo,
    setpad.nome AS SetorEstoquePadrao,
    ultimos_saldos.descricao AS Descricao,
    ultimos_saldos.setorEstoque AS setorEstoque,
    ultimos_saldos.saldoSetorFinal AS saldoSetorFinal
FROM (
    SELECT
        sep.id,
        sep.idProduto,
        p.nome AS cod,
        p.descricao AS descricao,
        sep.idSetorEstoque,
        se.nome AS setorEstoque,
        sep.idEmpresa,
        sep.dataMovimentacao,
        CASE
            WHEN sep.saldoSetorFinal <= 0 THEN sep.saldoSetorFinal
            ELSE sep.saldoSetorFinal
        END AS saldoFinal,
        sep.qtdeEntrada,
        sep.qtdeSaida,
        CASE
            WHEN sep.saldoSetorFinal <= 0 THEN sep.saldoSetorFinal
            ELSE sep.saldoSetorFinal
        END AS saldoSetorFinal,
        sep.idMovimentacao,
        tm.nome,
        ROW_NUMBER() OVER (
            PARTITION BY sep.idProduto, sep.idSetorEstoque
            ORDER BY sep.dataMovimentacao DESC, sep.id DESC
        ) AS rn
    FROM saldoestoque_produto sep
    LEFT JOIN setorestoque se ON se.id = sep.idSetorEstoque
    LEFT JOIN produto p ON p.id = sep.idProduto
    LEFT JOIN movimentacaoproducao mp ON mp.id = sep.idMovimentacao
    LEFT JOIN tipomovimentacao tm ON tm.id = mp.idTipoMovimentacao
    WHERE se.consideraComoSaldoDisponivel = 1
      AND p.ativo = 1
      AND p.idTipoProduto IN (5, 6, 10, 13, 14, 16, 21, 22, 8, 15)
      AND se.idEmpresa = 1
) AS ultimos_saldos
LEFT JOIN (
    SELECT
        p.idProduto,
        p.idSetorEstoquePadrao,
        sep.nome
    FROM produtoempresa p
    LEFT JOIN setorestoque sep ON sep.id = p.idSetorEstoquePadrao
    WHERE p.idEmpresa = 1
) setpad ON ultimos_saldos.idProduto = setpad.idProduto
WHERE rn = 1;


-- -----------------------------------------------------------------------------
-- Consulta2 → aba SQL_Dados (custo / data entrada) — CORRIGIDA
-- Colunas: idProduto, valorUnitario, dataEntrada, opcao
-- VLOOKUP em VALOR CUSTO (col 2) e DATA ENTRADA (col 3)
-- -----------------------------------------------------------------------------
SELECT
    cunit.idProduto,
    ROUND(
        CASE
            WHEN cunit.bobina <> '' THEN bobin.valorUnitarioTotal
            ELSE cunit.valorUnitarioTotal
        END,
        2
    ) AS valorUnitario,
    DATE(
        CASE
            WHEN cunit.bobina <> '' THEN bobin.dataEntrada
            ELSE cunit.dataEntrada
        END
    ) AS dataEntrada,
    COALESCE(tm.opcao, 'Material Secundário') AS opcao
FROM (
    SELECT
        ud.idProduto,
        REPLACE(
            (
                CASE
                    WHEN p.descricao LIKE 'BOBINA%X%MM%' THEN (
                        CASE
                            WHEN LENGTH(p.descricao) - LENGTH(REPLACE(UPPER(p.descricao), 'X', '')) = 1
                                THEN CONCAT(
                                    TRIM(SUBSTRING_INDEX(UPPER(p.descricao), 'X', 1)),
                                    SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                                )
                            ELSE CONCAT(
                                LEFT(UPPER(p.descricao), LENGTH(SUBSTRING_INDEX(p.descricao, 'X', 2))),
                                SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                            )
                        END
                    )
                    ELSE ''
                END
            ),
            'BOBINA INTEIRA',
            'BOBINA SLITADA'
        ) AS bobina,
        m.valorUnitario AS valorUnitarioTotal,
        ud.dataEntrada
    FROM (
        SELECT
            ide.idProduto,
            MAX(d.dataEntrada) AS dataEntrada
        FROM itemdocumentoestoque ide
        LEFT JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
        WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 174, 142)
          AND ide.idSetorEntrada IN (2, 19, 20, 32)
        GROUP BY ide.idProduto
    ) ud
    LEFT JOIN (
        SELECT
            ide.id,
            ide.idDocumentoEstoque AS idDocumentoEntrada,
            ide.idProduto,
            ide.idTipoMovimentacao,
            d.dataEntrada,
            d.valorTotalFrete,
            p.nome,
            ide.qtde,
            ide.valorUnitario
        FROM itemdocumentoestoque ide
        LEFT JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
        LEFT JOIN produto p ON p.id = ide.idProduto
        WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 174, 142)
          AND ide.idSetorEntrada IN (2, 19, 20, 32)
    ) m ON (m.idProduto = ud.idProduto) AND (ud.dataEntrada = m.dataEntrada)
    LEFT JOIN produto p ON m.idProduto = p.id
) cunit
LEFT JOIN (
    SELECT DISTINCT
        ud.bobina,
        m.valorUnitario AS valorUnitarioTotal,
        ud.dataEntrada
    FROM (
        SELECT
            (
                CASE
                    WHEN LENGTH(p.descricao) - LENGTH(REPLACE(UPPER(p.descricao), 'X', '')) = 1
                        THEN CONCAT(
                            TRIM(SUBSTRING_INDEX(UPPER(p.descricao), 'X', 1)),
                            SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                        )
                    ELSE CONCAT(
                        LEFT(UPPER(p.descricao), LENGTH(SUBSTRING_INDEX(p.descricao, 'X', 2))),
                        SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                    )
                END
            ) AS bobina,
            MAX(d.dataEntrada) AS dataEntrada
        FROM itemdocumentoestoque ide
        LEFT JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
        LEFT JOIN produto p ON p.id = ide.idProduto
        WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 174, 142)
          AND ide.idSetorEntrada IN (2, 19, 20, 32)
          AND REPLACE(UPPER(p.descricao), 'INOX', 'INO') LIKE 'BOBINA%X%MM%'
          AND REPLACE(UPPER(p.descricao), 'INOX', 'INO') NOT LIKE '%ETIQUETA%'
        GROUP BY 1
    ) ud
    LEFT JOIN (
        SELECT
            REPLACE(
                CASE
                    WHEN UPPER(p.descricao) LIKE 'BOBINA%X%MM%' THEN (
                        CASE
                            WHEN LENGTH(p.descricao) - LENGTH(REPLACE(UPPER(p.descricao), 'X', '')) = 1
                                THEN CONCAT(
                                    TRIM(SUBSTRING_INDEX(UPPER(p.descricao), 'X', 1)),
                                    SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                                )
                            ELSE CONCAT(
                                LEFT(UPPER(p.descricao), LENGTH(SUBSTRING_INDEX(p.descricao, 'X', 2))),
                                SUBSTRING(UPPER(p.descricao), LOCATE('MM', UPPER(p.descricao)) + 2)
                            )
                        END
                    )
                    ELSE UPPER(p.descricao)
                END,
                'BOBINA INTEIRA',
                'BOBINA SLITADA'
            ) AS bobina,
            d.dataEntrada,
            ide.valorUnitario,
            p.descricao
        FROM itemdocumentoestoque ide
        LEFT JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
        LEFT JOIN produto p ON p.id = ide.idProduto
        WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 174, 142)
          AND ide.idSetorEntrada IN (2, 19, 20, 32)
    ) m ON (m.bobina = ud.bobina) AND (ud.dataEntrada = m.dataEntrada)
    WHERE CASE WHEN UPPER(m.descricao) LIKE 'BOBINA%X%MM%' THEN 1 ELSE 0 END = 1
) bobin ON bobin.bobina = cunit.bobina
LEFT JOIN (
    SELECT
        apv.idProduto,
        alo.opcao
    FROM atributoprodutovalor apv
    LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
    WHERE apv.idAtributo = 540
) tm ON tm.idProduto = cunit.idProduto;
