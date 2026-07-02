/* DRE 6.2.1 — entradas COM Shop9 (SM%, filiais 5 e 6) para fallback de custo unitário.
   Parâmetros: @dataFim (datetime) — carrega histórico até a data fim do filtro DRE. */
SELECT
  m.Ordem_Filial AS ordemFilial,
  mps.Ordem AS ordemMps,
  m.DATA AS dataMovimento,
  m.Tipo_Operacao AS tipoOperacao,
  o.Nome AS nomeOperacao,
  mps.Ordem_Movimento AS ordemMovimento,
  mps.Ordem_Prod_Serv AS ordemProdServ,
  REPLACE(ps.Codigo, '-', ' ') AS codigoProduto,
  ps.Nome AS nomeProduto,
  mps.Quantidade AS quantidade,
  mps.Preco_Unitario AS precoUnitario
FROM Movimento_Prod_Serv mps
LEFT JOIN Prod_Serv ps ON ps.Ordem = mps.Ordem_Prod_Serv
LEFT JOIN Movimento m ON m.Ordem = mps.Ordem_Movimento
LEFT JOIN Operacoes o ON o.Ordem = m.Ordem_Operacao
WHERE ps.Codigo LIKE 'SM%'
  AND m.Tipo_Operacao = 'COM'
  AND m.Ordem_Filial IN (5, 6)
  AND m.DATA <= @dataFim
