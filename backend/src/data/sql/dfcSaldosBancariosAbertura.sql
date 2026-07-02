/* Saldo acumulado antes de dataInicio (por conta bancária). */
SELECT
    cb.id AS idContaBancaria,
    cb.nome AS nomeContaBancaria,
    MAX(lf.idEmpresa) AS idEmpresa,
    SUM(
        CASE
            WHEN lf.discriminador = 'LR' THEN lf.valor
            ELSE -1 * lf.valor
        END
    ) AS saldoAbertura
FROM lancamentofinanceiro lf
LEFT JOIN contabancaria cb ON cb.id = lf.idContaBancaria
WHERE DATE(lf.dataLancamento) < ?
  AND cb.id IS NOT NULL
GROUP BY
    cb.id,
    cb.nome
