-- Análise de Comissionamento — base itempedido (Só Aço).
-- Placeholders: __DATA_INI__ / __DATA_FIM__ (YYYY-MM-DD).
-- Exclui cancelados (status 6) e pedidos com atributo 313 = 'Sim' (loja/interna).
-- Inclui apenas req.opcao = 'Não' (atributo 313).

SELECT
  pe.idEmpresa AS idEmpresa,
  UPPER(COALESCE(emp.nome, '')) AS empresa,
  ip.id AS idItem,
  pe.id AS pdId,
  pe.nome AS pdCodigo,
  DATE_FORMAT(pe.dataEmissao, '%Y-%m-%d') AS dataEmissao,
  DATE_FORMAT(pe.dataEmissao, '%Y-%m') AS mes,
  ip.idProduto AS idProduto,
  COALESCE(p.nome, '') AS codigoProduto,
  COALESCE(p.descricao, '') AS descricaoProduto,
  COALESCE(pec.nome, pec.nomeRazaoSocial, '—') AS cliente,
  COALESCE(gp.nome, '—') AS grupoProduto,
  ip.qtde AS qtde,
  ip.precoUnitario AS precoUnitario,
  ip.valorTotal AS valorTotal,
  ip.valorDesconto AS valorDesconto,
  ip.valorTotalComDesconto AS valorVendido,
  COALESCE(pev.nome, per.nome, '—') AS vendedor,
  CASE
    WHEN ip.status = 1 THEN 'Aguardando liberação'
    WHEN ip.status = 2 THEN 'Liberado'
    WHEN ip.status = 5 THEN 'Atendido com corte'
    WHEN ip.status = 3 THEN 'Atendido parcialmente'
    WHEN ip.status = 4 THEN 'Atendido totalmente'
    WHEN ip.status = 6 THEN 'Cancelado'
    WHEN ip.status = 7 THEN 'Devolvido parcialmente'
    WHEN ip.status = 8 THEN 'Devolvido totalmente'
    ELSE 'Sem status'
  END AS status,
  COALESCE(req.opcao, '') AS requisicao
FROM itempedido ip
LEFT JOIN pedido pe ON pe.id = ip.idPedido
LEFT JOIN produto p ON p.id = ip.idProduto
LEFT JOIN grupoproduto gp ON gp.id = p.idGrupoProduto
LEFT JOIN pessoa per ON per.id = pe.idRepresentante
LEFT JOIN pessoa pev ON pev.id = pe.idVendedor
LEFT JOIN pessoa pec ON pec.id = pe.idCliente
LEFT JOIN empresa emp ON emp.id = pe.idEmpresa
LEFT JOIN (
  SELECT
    a.idPedido,
    alo.opcao
  FROM atributopedidovalor a
  LEFT JOIN atributolistaopcao alo ON alo.id = a.idListaOpcao
  WHERE a.idAtributo = 313
) req ON req.idPedido = pe.id
WHERE pe.idEmpresa = 1
  AND DATE(pe.dataEmissao) >= '__DATA_INI__'
  AND DATE(pe.dataEmissao) <= '__DATA_FIM__'
  AND ip.status <> 6
  AND req.opcao = 'Não'
;
