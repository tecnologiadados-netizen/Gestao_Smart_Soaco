-- Saldo por setor (último movimento) para modal de estoque do componente.
SELECT
    se.id AS id_setor,
    se.nome AS nome_setor,
    CASE
        WHEN sp.saldoSetorFinal <= 0 THEN 0
        ELSE sp.saldoSetorFinal
    END AS saldo
FROM weberp_soaco.saldoestoque_produto sp
INNER JOIN (
    SELECT idProduto, idSetorEstoque, MAX(dataMovimentacao) AS maxData
    FROM weberp_soaco.saldoestoque_produto
    WHERE idProduto = ?
      AND idEmpresa = 1
    GROUP BY idProduto, idSetorEstoque
) ult ON ult.idProduto = sp.idProduto
      AND ult.idSetorEstoque = sp.idSetorEstoque
      AND sp.dataMovimentacao = ult.maxData
INNER JOIN weberp_soaco.setorestoque se ON se.id = sp.idSetorEstoque
WHERE sp.idProduto = ?
  AND sp.idEmpresa = 1
  AND sp.saldoSetorFinal > 0
ORDER BY se.nome
