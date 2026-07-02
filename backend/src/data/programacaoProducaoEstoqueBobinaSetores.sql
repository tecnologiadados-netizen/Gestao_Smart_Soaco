-- Saldo por setor (19, 20) — último registro por MAX(id), alinhado ao MRP.
SELECT
    se.id AS id_setor,
    se.nome AS nome_setor,
    GREATEST(IFNULL((
        SELECT sep.saldoSetorFinal
        FROM weberp_soaco.saldoestoque_produto sep
        WHERE sep.id = (
            SELECT MAX(sp.id)
            FROM weberp_soaco.saldoestoque_produto sp
            WHERE sp.idSetorEstoque = se.id
              AND sp.idProduto = ?
              AND sp.idEmpresa = 1
        )
    ), 0), 0) AS saldo
FROM weberp_soaco.setorestoque se
WHERE se.id IN (19, 20)
ORDER BY se.nome
