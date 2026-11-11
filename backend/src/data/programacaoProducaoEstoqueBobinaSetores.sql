-- Saldo por setor (19, 20) — último movimento por dataMovimentacao + id
-- (padrão Nomus / Consulta Estoque). MAX(id) sozinho falha quando movimentos
-- são gravados fora de ordem cronológica.
WITH ultimo_saldo_setor AS (
    SELECT
        sep.idSetorEstoque,
        CASE WHEN sep.saldoSetorFinal <= 0 THEN 0 ELSE sep.saldoSetorFinal END AS saldo,
        ROW_NUMBER() OVER (
            PARTITION BY sep.idProduto, sep.idSetorEstoque
            ORDER BY sep.dataMovimentacao DESC, sep.id DESC
        ) AS rn
    FROM weberp_soaco.saldoestoque_produto sep
    WHERE sep.idProduto = ?
      AND sep.idEmpresa = 1
      AND sep.idSetorEstoque IN (19, 20)
)
SELECT
    se.id AS id_setor,
    se.nome AS nome_setor,
    COALESCE(u.saldo, 0) AS saldo
FROM weberp_soaco.setorestoque se
LEFT JOIN ultimo_saldo_setor u ON u.idSetorEstoque = se.id AND u.rn = 1
WHERE se.id IN (19, 20)
ORDER BY se.nome
