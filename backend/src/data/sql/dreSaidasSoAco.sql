/* DRE — Saídas SOACO: agendamentos a pagar efetivos (discriminador P), por competência.
   Placeholders: {{ID_EMPRESAS_IN}}, {{DATA_COMPETENCIA_MIN}}, {{DATA_COMPETENCIA_MAX}} */
SELECT
  af.id,
  af.discriminador,
  af.descricaoLancamento,
  af.idPessoa,
  pe.nome AS nomePessoa,
  af.dataVencimento,
  af.dataAgendamento,
  DATE(af.dataCompetencia) AS dataCompetencia,
  af.valorBaixar,
  af.valorBaixarAgendado,
  CASE
    WHEN (pg.valorpago IS NULL OR pg.valorpago = 0) THEN
      CASE
        WHEN (af.valorBaixado IS NULL OR af.valorBaixado = 0) THEN af.saldoBaixar
        ELSE af.valorBaixado
      END
    ELSE pg.valorpago
  END AS valorBaixado,
  af.idContaFinanceiro,
  af.idEmpresa,
  cf.nome AS nomePlanoFinanceiro,
  YEAR(af.dataCompetencia) AS ano,
  MONTH(af.dataCompetencia) AS mes,
  sn.idAgendamentoPagamento AS idLancamento,
  DATE(af.dataBaixa) AS dataBaixa,
  CASE
    WHEN (sn.idAgendamentoPagamento IS NULL AND DATE(af.dataBaixa) IS NOT NULL) THEN 'Sem Numerario'
    ELSE 'Efetiva'
  END AS status
FROM agendamentofinanceiro af
LEFT JOIN pessoa pe ON pe.id = af.idPessoa
LEFT JOIN contafinanceiro cf ON cf.id = af.idContaFinanceiro
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
WHERE DATE(af.dataCompetencia) >= '{{DATA_COMPETENCIA_MIN}}'
  AND DATE(af.dataCompetencia) <= '{{DATA_COMPETENCIA_MAX}}'
  AND af.discriminador = 'P'
  AND af.idEmpresa IN ({{ID_EMPRESAS_IN}})
  AND af.idPedidoCompra IS NULL
  AND CASE
    WHEN (sn.idAgendamentoPagamento IS NULL AND DATE(af.dataBaixa) IS NOT NULL) THEN 'Sem Numerario'
    ELSE 'Efetiva'
  END = 'Efetiva'
