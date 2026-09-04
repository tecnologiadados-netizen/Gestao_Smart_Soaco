/* DFC Shop9 — só títulos a PAGAR em aberto (Situacao=A), para classificação / KPIs.
   Params: @dataInicio, @dataFim (DATE). */
SELECT
  fc.Ordem AS ordemFinanceira,
  fc.Ordem AS codigoConta,
  fc.Pagar_Receber AS tipoConta,
  CAST(fc.Data_Vencimento AS DATE) AS dataVencimento,
  CAST(NULL AS DATE) AS dataBaixa,
  fc.Descricao AS descricaoLancamento,
  CASE
    WHEN pc.Codigo IN (10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10010, 10011, 10012)
      THEN 2
    ELSE pc.Codigo
  END AS idPlanoContas,
  CASE
    WHEN pc.Codigo IN (10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10010, 10011, 10012)
      THEN 'Receitas de Vendas de Produto'
    WHEN pc.Nome LIKE '%Devolução de Pagamento%'
      THEN 'Devolução de Pagamento'
    ELSE pc.Nome
  END AS planoContas,
  CAST(0 AS DECIMAL(18, 2)) AS valorBaixado,
  ISNULL(fc.Valor_Total_Calculado, 0) AS saldoBaixar,
  ISNULL(fc.Valor_Total_Calculado, 0) AS valorTotalCalculado,
  fc.Ordem_Filial AS idEmpresa,
  CASE
    WHEN cc.Nome = 'Não Cadastrado' THEN fl.Nome
    ELSE cc.Nome
  END AS empresa,
  fl.Nome AS nomeFilial,
  cc.Nome AS centrocusto,
  cf.Nome AS nomeRazaoSocial,
  cf.Fantasia AS clienteFornecedor
FROM Financeiro_Contas fc
LEFT JOIN Plano_Contas3 pc ON pc.Ordem = fc.Ordem_Plano_Contas3
LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
WHERE fc.Situacao = 'A'
  AND fc.Pagar_Receber = 'P'
  AND fc.Data_Vencimento IS NOT NULL
  AND CAST(fc.Data_Vencimento AS DATE) >= @dataInicio
  AND CAST(fc.Data_Vencimento AS DATE) <= @dataFim
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (
    fc.Descricao IS NULL
    OR fc.Descricao NOT LIKE '%conta pai%'
  );
