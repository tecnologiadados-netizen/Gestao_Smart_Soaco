-- Busca de clientes (pessoa) Nomus para políticas comerciais «Outras».
SELECT
  p.id,
  IFNULL(p.nome, '') AS nome,
  p.idGrupoPessoa,
  IFNULL(gp.grupo, '') AS grupo
FROM pessoa p
LEFT JOIN grupopessoa gp ON gp.id = p.idGrupoPessoa
WHERE (
  ? = ''
  OR CAST(p.id AS CHAR) LIKE CONCAT('%', ?, '%')
  OR p.nome LIKE CONCAT('%', ?, '%')
  OR IFNULL(gp.grupo, '') LIKE CONCAT('%', ?, '%')
)
ORDER BY
  CASE WHEN IFNULL(gp.grupo, '') <> '' THEN 0 ELSE 1 END,
  IFNULL(gp.grupo, ''),
  p.nome
LIMIT ?
