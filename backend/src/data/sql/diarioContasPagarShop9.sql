/* Diário Financeiro — contas a pagar Shop9 por data de vencimento.
   Em aberto (Situacao=A) UNION baixados (quitação até hoje).
   Params: @dataInicio, @dataFim (DATE). */
SELECT
  fc.Ordem AS ordemFinanceira,
  fc.Ordem AS codigoConta,
  fc.Pagar_Receber AS tipoConta,
  fc.Situacao AS situacao,
  'Em aberto' AS statusBaixa,
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
  cf.Fantasia AS clienteFornecedor,
  cbanco.Nome AS contaBancaria,
  fc.Tipo_Conta AS tipoContaCodigo,
  ac.Nome AS administradoraNome,
  fc.Parcela_Descricao AS parcelaDescricao
FROM Financeiro_Contas fc
LEFT JOIN Plano_Contas3 pc ON pc.Ordem = fc.Ordem_Plano_Contas3
LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
LEFT JOIN Contas_Bancarias cbanco ON cbanco.Ordem = fc.Ordem_Conta_Bancaria
LEFT JOIN Administradoras_Cartao ac ON ac.Ordem = fc.Cartao_Ordem_Administradora
WHERE fc.Pagar_Receber = 'P'
  AND fc.Situacao = 'A'
  AND fc.Data_Vencimento IS NOT NULL
  AND CAST(fc.Data_Vencimento AS DATE) >= @dataInicio
  AND CAST(fc.Data_Vencimento AS DATE) <= @dataFim
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (
    fc.Descricao IS NULL
    OR fc.Descricao NOT LIKE '%conta pai%'
  )

UNION ALL

SELECT
  fc.Ordem AS ordemFinanceira,
  fc.Ordem AS codigoConta,
  fc.Pagar_Receber AS tipoConta,
  fc.Situacao AS situacao,
  'Baixado' AS statusBaixa,
  CAST(fc.Data_Vencimento AS DATE) AS dataVencimento,
  CAST(fc.Data_Quitacao AS DATE) AS dataBaixa,
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
  ISNULL(fc.Valor_Quitado, 0) AS valorBaixado,
  CAST(0 AS DECIMAL(18, 2)) AS saldoBaixar,
  ISNULL(fc.Valor_Total_Calculado, 0) AS valorTotalCalculado,
  fc.Ordem_Filial AS idEmpresa,
  CASE
    WHEN cc.Nome = 'Não Cadastrado' THEN fl.Nome
    ELSE cc.Nome
  END AS empresa,
  fl.Nome AS nomeFilial,
  cc.Nome AS centrocusto,
  cf.Nome AS nomeRazaoSocial,
  cf.Fantasia AS clienteFornecedor,
  cbanco.Nome AS contaBancaria,
  fc.Tipo_Conta AS tipoContaCodigo,
  ac.Nome AS administradoraNome,
  fc.Parcela_Descricao AS parcelaDescricao
FROM Financeiro_Contas fc
LEFT JOIN Plano_Contas3 pc ON pc.Ordem = fc.Ordem_Plano_Contas3
LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
LEFT JOIN Contas_Bancarias cbanco ON cbanco.Ordem = fc.Ordem_Conta_Bancaria
LEFT JOIN Administradoras_Cartao ac ON ac.Ordem = fc.Cartao_Ordem_Administradora
WHERE fc.Pagar_Receber = 'P'
  AND fc.Situacao <> 'C'
  AND fc.Data_Quitacao IS NOT NULL
  AND CAST(fc.Data_Quitacao AS DATE) <= CAST(GETDATE() AS DATE)
  AND fc.Tipo_Recebido_Pago <> ''
  AND fc.Tipo_Conta <> 'A'
  AND fc.Tipo_Conta <> 'J'
  AND fc.Data_Vencimento IS NOT NULL
  AND CAST(fc.Data_Vencimento AS DATE) >= @dataInicio
  AND CAST(fc.Data_Vencimento AS DATE) <= @dataFim
  AND ISNULL(fc.Valor_Quitado, 0) > 0
  AND (
    fc.Descricao IS NULL
    OR fc.Descricao NOT LIKE '%conta pai%'
  );
