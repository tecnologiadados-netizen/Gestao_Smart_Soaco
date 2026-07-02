/* Movimento diário por conta — igual ao WITH base do SQL de negócio (LR +, demais −). */
SELECT
    DATE(lf.dataLancamento) AS dataLancamento,
    cb.id AS idContaBancaria,
    cb.nome AS nomeContaBancaria,
    MAX(lf.idEmpresa) AS idEmpresa,
    SUM(
        CASE
            WHEN lf.discriminador = 'LR' THEN lf.valor
            ELSE -1 * lf.valor
        END
    ) AS valorLancamento
FROM lancamentofinanceiro lf
LEFT JOIN contabancaria cb ON cb.id = lf.idContaBancaria
WHERE lf.dataLancamento >= ?
  AND lf.dataLancamento <= ?
  AND cb.id IS NOT NULL
GROUP BY
    DATE(lf.dataLancamento),
    cb.id,
    cb.nome
ORDER BY cb.id, DATE(lf.dataLancamento)
