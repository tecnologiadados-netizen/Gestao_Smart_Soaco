-- DRE 2.1.1.x Devoluções (Só Aço / Só Móveis) — agregado por idEmpresaEntrada e dataEmissao.
-- Parâmetros: data mínima fixa (1), dataInicio (2), dataFim (3), idEmpresaEntrada IN (4).
SELECT
  de.idEmpresaEntrada,
  DATE(de.dataEmissao) AS dataEmissao,
  MONTH(de.dataEmissao) AS mes,
  YEAR(de.dataEmissao) AS ano,
  SUM(ide.valorTotal) AS valorTotal
FROM itemdocumentoestoque ide
LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
LEFT JOIN documentoestoque de ON ide.idDocumentoEntrada = de.id
LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
LEFT JOIN produto pd ON pd.id = ide.idProduto
LEFT JOIN grupoproduto gp ON pd.idGrupoProduto = gp.id
LEFT JOIN familiaproduto fp ON pd.idFamiliaProduto = fp.id
WHERE (ISNULL(nfe.status) = 1 OR nfe.status = 4)
  AND tm.id IN (52, 170, 179)
  AND DATE(de.dataEmissao) >= ?
  AND DATE(de.dataEmissao) BETWEEN ? AND ?
  AND de.idEmpresaEntrada IN (?)
GROUP BY
  de.idEmpresaEntrada,
  DATE(de.dataEmissao),
  MONTH(de.dataEmissao),
  YEAR(de.dataEmissao)
ORDER BY
  dataEmissao,
  de.idEmpresaEntrada
