/* DFC Shop9 — base: abertos + quitados (UNION). Params @dataEmissaoMin/@dataRelacaoMin ficam só para compatibilidade com o driver. */
WITH base AS (
  SELECT
    fc.Ordem,
    fc.Pagar_Receber,
    fc.Ordem_Conta_Bancaria,
    fc.Tela_Origem,
    fc.Tela_Quitacao,
    fc.Ordem_Pai,
    fc.Descricao,
    fc.Ordem_Renegociado_Agrupado,
    fc.Tipo_Conta,
    fc.Tipo_Recebido_Pago,
    fc.Situacao,
    fc.Ordem_Filial,
    CASE
      WHEN cc.Nome = 'Não Cadastrado' THEN fl.Nome
      ELSE cc.Nome
    END AS Filial,
    fc.Ordem_Centro_Custo,
    cc.Nome AS Nome_Centro_Custo,
    fc.Ordem_Cli_For,
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
    fc.Data_Vencimento,
    fc.Data_Quitacao,
    fc.Valor_Quitado,
    fc.Valor_Total_Calculado,
    'ABERTO' AS Tipo_Registro
  FROM Financeiro_Contas fc
  LEFT JOIN Plano_Contas3 pc ON pc.Ordem = fc.Ordem_Plano_Contas3
  LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
  LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
  LEFT JOIN Contas_Bancarias cb ON cb.Ordem = fc.Ordem_Conta_Bancaria
  LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
  WHERE
    CAST(fc.Data_Vencimento AS DATE) >= '2024-01-01'
    AND fc.Situacao = 'A'

  UNION ALL

  SELECT
    fc.Ordem,
    fc.Pagar_Receber,
    fc.Ordem_Conta_Bancaria,
    fc.Tela_Origem,
    fc.Tela_Quitacao,
    fc.Ordem_Pai,
    fc.Descricao,
    fc.Ordem_Renegociado_Agrupado,
    fc.Tipo_Conta,
    fc.Tipo_Recebido_Pago,
    fc.Situacao,
    fc.Ordem_Filial,
    CASE
      WHEN cc.Nome = 'Não Cadastrado' THEN fl.Nome
      ELSE cc.Nome
    END AS Filial,
    fc.Ordem_Centro_Custo,
    cc.Nome AS Nome_Centro_Custo,
    fc.Ordem_Cli_For,
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
    fc.Data_Vencimento,
    fc.Data_Quitacao,
    fc.Valor_Quitado,
    fc.Valor_Total_Calculado,
    'QUITADO' AS Tipo_Registro
  FROM Financeiro_Contas fc
  LEFT JOIN Plano_Contas3 pc ON pc.Ordem = fc.Ordem_Plano_Contas3
  LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
  LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
  LEFT JOIN Contas_Bancarias cb ON cb.Ordem = fc.Ordem_Conta_Bancaria
  LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
  WHERE
    CAST(fc.Data_Quitacao AS DATE) >= '2025-01-01'
    AND (fc.Tipo_Recebido_Pago <> '' AND fc.Tipo_Conta <> 'A' AND fc.Tipo_Conta <> 'J')
)
SELECT
  b.Ordem AS codigoConta,
  b.Pagar_Receber AS tipoConta,
  CASE
    WHEN b.Data_Quitacao IS NOT NULL
      AND CAST(b.Data_Quitacao AS DATE) <= CAST(GETDATE() AS DATE)
    THEN CAST(b.Data_Quitacao AS DATE)
    ELSE NULL
  END AS dataBaixa,
  CAST(b.Data_Vencimento AS DATE) AS dataVencimento,
  b.Descricao AS descricaoLancamento,
  b.idPlanoContas,
  b.planoContas,
  CASE
    WHEN b.Data_Quitacao IS NOT NULL
      AND CAST(b.Data_Quitacao AS DATE) <= CAST(GETDATE() AS DATE)
    THEN ISNULL(b.Valor_Quitado, 0)
    ELSE 0
  END AS valorBaixado,
  CASE
    WHEN b.Data_Vencimento IS NOT NULL
      AND CAST(b.Data_Vencimento AS DATE) > CAST(GETDATE() AS DATE)
    THEN ISNULL(b.Valor_Total_Calculado, 0)
    ELSE 0
  END AS saldoBaixar,
  b.Ordem_Filial AS idEmpresa,
  b.Filial AS empresa,
  fl.Nome AS nomeFilial,
  b.Nome_Centro_Custo AS centrocusto,
  cf.Nome AS nomeRazaoSocial,
  cf.Fantasia AS clienteFornecedor,
  b.Ordem AS ordemFinanceira
FROM base b
LEFT JOIN Filiais fl ON fl.Ordem = b.Ordem_Filial
LEFT JOIN Cli_For cf ON cf.Ordem = b.Ordem_Cli_For;
