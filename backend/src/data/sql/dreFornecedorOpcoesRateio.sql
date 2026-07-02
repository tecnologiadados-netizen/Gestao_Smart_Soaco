/* DRE — fornecedores distintos para configuração de rateio (sem filtro de período).
   Placeholders: {{ID_EMPRESAS_IN}}, {{ID_CONTAS_IN}} */
SELECT nomePessoa
FROM (
  SELECT DISTINCT TRIM(pe.nome) AS nomePessoa
  FROM agendamentofinanceiro af
  INNER JOIN pessoa pe ON pe.id = af.idPessoa
  LEFT JOIN (
    SELECT DISTINCT idAgendamentoPagamento
    FROM lancamentofinanceiro l
    WHERE idAgendamentoPagamento IS NOT NULL
  ) sn ON sn.idAgendamentoPagamento = af.id
  LEFT JOIN (
    SELECT idAgendamentoPagamento, SUM(valor) AS valorpago
    FROM lancamentofinanceiro l
    WHERE idAgendamentoPagamento IS NOT NULL
    GROUP BY idAgendamentoPagamento
  ) pg ON pg.idAgendamentoPagamento = af.id
  WHERE af.discriminador = 'P'
    AND af.idEmpresa IN ({{ID_EMPRESAS_IN}})
    AND af.idPedidoCompra IS NULL
    AND af.idContaFinanceiro IN ({{ID_CONTAS_IN}})
    AND CASE
      WHEN (sn.idAgendamentoPagamento IS NULL AND DATE(af.dataBaixa) IS NOT NULL) THEN 'Sem Numerario'
      ELSE 'Efetiva'
    END = 'Efetiva'
    AND (
      CASE
        WHEN (pg.valorpago IS NULL OR pg.valorpago = 0) THEN
          CASE
            WHEN (af.valorBaixado IS NULL OR af.valorBaixado = 0) THEN af.saldoBaixar
            ELSE af.valorBaixado
          END
        ELSE pg.valorpago
      END
    ) > 0
    AND pe.nome IS NOT NULL
    AND TRIM(pe.nome) <> ''

  UNION

  SELECT DISTINCT TRIM(pe.nome) AS nomePessoa
  FROM lancamentofinanceiro lf
  INNER JOIN pessoa pe ON pe.id = lf.idPessoa
  WHERE lf.idEmpresa IN ({{ID_EMPRESAS_IN}})
    AND lf.discriminador = 'LP'
    AND lf.idAgendamentoPagamento IS NULL
    AND lf.idContaFinanceiro IN ({{ID_CONTAS_IN}})
    AND lf.valor > 0
    AND pe.nome IS NOT NULL
    AND TRIM(pe.nome) <> ''
) AS fornecedores
ORDER BY nomePessoa
