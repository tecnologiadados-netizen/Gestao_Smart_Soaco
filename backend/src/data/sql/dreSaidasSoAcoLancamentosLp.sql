/* DRE — Saídas SOACO: lançamentos LP avulsos (sem agendamento), por competência.
   Placeholders: {{ID_EMPRESAS_IN}}, {{DATA_COMPETENCIA_MIN}}, {{DATA_COMPETENCIA_MAX}} */
SELECT
  lf.id,
  lf.idAgendamentoPagamento,
  lf.idContaFinanceiro,
  lf.descricao,
  lf.valor AS valorBaixado,
  lf.dataLancamento,
  DATE(lf.dataCompetencia) AS dataCompetencia,
  lf.idEmpresa,
  cf.nome AS nomePlanoFinanceiro,
  lf.idPessoa,
  pe.nome AS nomePessoa,
  YEAR(lf.dataCompetencia) AS ano,
  MONTH(lf.dataCompetencia) AS mes
FROM lancamentofinanceiro lf
LEFT JOIN contafinanceiro cf ON cf.id = lf.idContaFinanceiro
LEFT JOIN pessoa pe ON pe.id = lf.idPessoa
WHERE lf.idEmpresa IN ({{ID_EMPRESAS_IN}})
  AND lf.discriminador = 'LP'
  AND DATE(lf.dataCompetencia) >= '{{DATA_COMPETENCIA_MIN}}'
  AND DATE(lf.dataCompetencia) <= '{{DATA_COMPETENCIA_MAX}}'
  AND lf.idAgendamentoPagamento IS NULL
