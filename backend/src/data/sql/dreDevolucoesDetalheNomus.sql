-- DRE 2.1.1.1 / 2.1.1.2 — Detalhe de Devoluções (Só Aço / Só Móveis) item a item.
-- Mesma base do agregado (dreDevolucoesNomus.sql), porém por item de documento.
-- Parâmetros: data mínima fixa (1), dataInicio (2), dataFim (3), idEmpresaEntrada IN (4), LIMIT (5).
SELECT
  ide.id AS idItemDocumentoEstoque,
  de.idEmpresaEntrada,
  DATE(de.dataEmissao) AS dataEmissao,
  de.numeroDocumentoFiscal AS numeroDocumentoFiscal,
  tm.nome AS tipoMovimentacao,
  ide.idProduto,
  pd.nome AS produto,
  COALESCE(gp.nome, 'Outros') AS grupoProduto,
  ide.qtde,
  ide.valorUnitario,
  ide.valorTotal
FROM itemdocumentoestoque ide
LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
LEFT JOIN documentoestoque de ON ide.idDocumentoEntrada = de.id
LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
LEFT JOIN produto pd ON pd.id = ide.idProduto
LEFT JOIN grupoproduto gp ON pd.idGrupoProduto = gp.id
WHERE (ISNULL(nfe.status) = 1 OR nfe.status = 4)
  AND tm.id IN (52, 170, 179)
  AND DATE(de.dataEmissao) >= ?
  AND DATE(de.dataEmissao) BETWEEN ? AND ?
  AND de.idEmpresaEntrada IN (?)
ORDER BY de.dataEmissao DESC, ide.id DESC
LIMIT ?
