/* DRE — Saídas Shop9 (Financeiro_Contas), por competência.
   Empresas: Só Aço (filial 1), Só Refrigeração (filial 1 + CC), R N Marques (filial 1 + CC ou filial 6).
   Placeholders: {{DATA_COMPETENCIA_MIN}}, {{DATA_COMPETENCIA_MAX}}, {{ORDEM_FILIAL_IN}} */
SELECT
  fc.ordem,
  fc.Ordem_Pai,
  fc.Ordem_Renegociado_Agrupado,
  fc.Ordem_Filial,
  CONVERT(date, fc.Data_Vencimento) AS Data_Vencimento,
  CONVERT(date, fc.Data_Competencia) AS Data_Competencia,
  CONVERT(date, fc.Data_Quitacao) AS Data_Quitacao,
  fc.Ordem_Cli_For,
  fc.Descricao AS DescricaoLancamento,
  cf.Nome AS NomeCliFor,
  TRIM(REPLACE(fc.Ordem_Plano_Contas3, ' (INATIVA)', '')) AS Ordem_Plano_Contas3,
  pc3.Nome AS NomePlanoContas,
  fc.Ordem_Centro_Custo,
  CASE
    WHEN cc.Nome = 'Não Cadastrado' THEN fl.Nome
    ELSE cc.Nome
  END AS empresa,
  fl.Nome AS nomeFilial,
  cc.Nome AS centrocusto,
  fc.Valor_Base,
  YEAR(fc.Data_Competencia) AS ano,
  MONTH(fc.Data_Competencia) AS mes
FROM Financeiro_Contas AS fc
LEFT JOIN Plano_Contas3 pc3 ON pc3.Ordem = fc.Ordem_Plano_Contas3
LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
WHERE fc.Ordem_Filial IN ({{ORDEM_FILIAL_IN}})
  AND CONVERT(date, fc.Data_Competencia) >= '{{DATA_COMPETENCIA_MIN}}'
  AND CONVERT(date, fc.Data_Competencia) <= '{{DATA_COMPETENCIA_MAX}}'
  AND fc.Situacao <> 'C'
