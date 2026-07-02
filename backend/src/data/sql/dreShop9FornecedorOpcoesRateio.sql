/* DRE — fornecedores Shop9 distintos para configuração de rateio (sem filtro de período).
   Placeholders: {{ORDEM_FILIAL_IN}}, {{ORDEM_PLANO_IN}} */
SELECT DISTINCT TRIM(cf.Nome) AS nomeCliFor
FROM Financeiro_Contas AS fc
INNER JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
WHERE fc.Ordem_Filial IN ({{ORDEM_FILIAL_IN}})
  AND fc.Ordem_Plano_Contas3 IN ({{ORDEM_PLANO_IN}})
  AND fc.Situacao <> 'C'
  AND ABS(fc.Valor_Base) > 0
  AND cf.Nome IS NOT NULL
  AND LTRIM(RTRIM(cf.Nome)) <> ''
ORDER BY nomeCliFor
