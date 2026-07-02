SELECT
    p.id            AS id,
    p.nome          AS codigo,
    p.descricao     AS descricao
FROM weberp_soaco.produto p
INNER JOIN weberp_soaco.tipoproduto tp ON tp.id = p.idTipoProduto
WHERE p.ativo = 1
  AND tp.id = 16
  AND p.idFamiliaProduto = 65
  AND (
    ? = ''
    OR p.nome LIKE ?
    OR UPPER(p.descricao) LIKE UPPER(?)
  )
ORDER BY p.nome ASC
LIMIT ?
