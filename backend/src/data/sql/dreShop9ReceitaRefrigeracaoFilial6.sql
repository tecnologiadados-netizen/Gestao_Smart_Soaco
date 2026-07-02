/* DRE — Faturamento/CMV direto RN Marques, Shop9 filial 6 (Movimento).
     1.6.1 Faturamento Direto (Preco_Total_Sem_Desconto_Somado)
     2.1.3.4 Desconto R N Marques (Desconto_Valor_Somado)
     6.3.1 CMV Direto (Preco_Custo_Somado; se custo > preço → preço × 0,41)
   Placeholders: {{DATA_EMISSAO_MIN}}, {{DATA_EMISSAO_MAX}} */
SELECT
  m.Ordem,
  m.Ordem_Filial,
  CONVERT(date, mdf.Data_Emissao) AS Data_Emissao,
  m.Preco_Total_Sem_Desconto_Somado,
  m.Desconto_Valor_Somado,
  m.Preco_Final_Somado,
  CASE
    WHEN m.Preco_Custo_Somado > m.Preco_Final_Somado THEN m.Preco_Final_Somado * 0.41
    ELSE m.Preco_Custo_Somado
  END AS Preco_Custo_Somado,
  f.Nome AS Nome_Vendedor
FROM Movimento m
LEFT JOIN Movimento_Documentos_Fiscais mdf
  ON mdf.Ordem_Movimento = m.Ordem
LEFT JOIN Funcionarios f
  ON f.Ordem = m.Ordem_Vendedor1
WHERE CONVERT(date, mdf.Data_Emissao) >= '{{DATA_EMISSAO_MIN}}'
  AND CONVERT(date, mdf.Data_Emissao) <= '{{DATA_EMISSAO_MAX}}'
  AND m.Ordem_Filial = 6
  AND mdf.Documento_Cancelado = 0
  AND mdf.Tipo_Documento = 'P'
  AND m.Tipo_Operacao <> 'DEV'
  AND mdf.Situacao_Danfe = 2
  AND mdf.Documento_Inutilizado IS NULL
  AND EXISTS (
    SELECT 1
    FROM Movimento_Prod_Serv mps
    WHERE mps.Ordem_Movimento = m.Ordem
      AND mps.Linha_Excluida = 0
      AND mdf.Situacao_Danfe = 2
  )
