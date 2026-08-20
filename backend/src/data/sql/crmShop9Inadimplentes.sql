/* Contas a receber em aberto e vencidas no Shop9 (inadimplentes). */
SELECT
  fc.Ordem AS codigoConta,
  CAST(fc.Data_Vencimento AS DATE) AS dataVencimento,
  ISNULL(fc.Valor_Total_Calculado, 0) AS valorTotal,
  ISNULL(fc.Valor_Quitado, 0) AS valorQuitado,
  CASE
    WHEN ISNULL(fc.Valor_Total_Calculado, 0) - ISNULL(fc.Valor_Quitado, 0) > 0
      THEN ISNULL(fc.Valor_Total_Calculado, 0) - ISNULL(fc.Valor_Quitado, 0)
    ELSE ISNULL(fc.Valor_Total_Calculado, 0)
  END AS valorSaldo,
  DATEDIFF(DAY, CAST(fc.Data_Vencimento AS DATE), CAST(GETDATE() AS DATE)) AS diasAtraso,
  cf.Nome AS clienteNome,
  cf.Fantasia AS clienteFantasia,
  fc.Ordem_Filial AS ordemFilial,
  fl.Nome AS nomeFilial,
  cc.Nome AS centrocusto,
  cb.Nome AS banco,
  fc.Descricao AS descricao,
  fc.Tipo_Conta AS tipoConta,
  ac.Nome AS administradoraNome,
  fc.Parcela_Descricao AS parcelaDescricao
FROM Financeiro_Contas fc
LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
LEFT JOIN Contas_Bancarias cb ON cb.Ordem = fc.Ordem_Conta_Bancaria
LEFT JOIN Administradoras_Cartao ac ON ac.Ordem = fc.Cartao_Ordem_Administradora
WHERE fc.Pagar_Receber = 'R'
  AND fc.Situacao = 'A'
  AND fc.Data_Vencimento IS NOT NULL
  AND CAST(fc.Data_Vencimento AS DATE) < CAST(GETDATE() AS DATE)
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
  AND UPPER(LTRIM(RTRIM(ISNULL(fc.Tipo_Conta, '')))) NOT IN ('A', 'R', 'H', 'J');
