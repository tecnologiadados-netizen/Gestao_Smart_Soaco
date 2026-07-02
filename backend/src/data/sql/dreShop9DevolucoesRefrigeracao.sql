/* DRE — Devoluções Shop9 filial 1 (Movimento DEV), por data de emissão NF.

   Backend: 2.1.1.3 Só Refrigeração — Preco_Final_Somado (todos os vendedores).

   Placeholders: {{DATA_EMISSAO_MIN}}, {{DATA_EMISSAO_MAX}} */

SELECT
  m.Ordem,
  m.Ordem_Filial,
  CONVERT(date, mdf.Data_Emissao) AS Data_Emissao,
  m.Preco_Total_Sem_Desconto_Somado,
  m.Desconto_Valor_Somado,
  m.Preco_Final_Somado,
  f.Nome AS Nome_Vendedor
FROM Movimento m
LEFT JOIN Movimento_Documentos_Fiscais mdf
  ON mdf.Ordem_Movimento = m.Ordem
LEFT JOIN Funcionarios f
  ON f.Ordem = m.Ordem_Vendedor1
WHERE CONVERT(date, mdf.Data_Emissao) >= '{{DATA_EMISSAO_MIN}}'
  AND CONVERT(date, mdf.Data_Emissao) <= '{{DATA_EMISSAO_MAX}}'
  AND m.Ordem_Filial = 1
  AND mdf.Documento_Cancelado = 0
  AND mdf.Tipo_Documento = 'P'
  AND m.Tipo_Operacao = 'DEV'
  AND mdf.Documento_Inutilizado IS NULL
  AND EXISTS (
    SELECT 1
    FROM Movimento_Prod_Serv mps
    WHERE mps.Ordem_Movimento = m.Ordem
      AND mps.Linha_Excluida = 0
  )
