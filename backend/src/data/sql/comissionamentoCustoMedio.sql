/* Custo médio mensal por produto (entradas) — mesmo motor do CPV DRE Só Aço, sem MKP.
   Placeholders: {{DATA_ENTRADA_MIN}}, {{DATA_ENTRADA_MAX}}
   Retorna: idProduto, periodo (YYYY-MM-01), custoMedioMensal */
WITH
base AS (
  SELECT
    ide.id,
    ide.idDocumentoEstoque,
    ide.idProduto,
    ide.idTipoMovimentacao,
    ide.qtde,
    CASE WHEN p.descricao LIKE '%GRAMPO%GRAMPEADO%PNEU%' THEN 0.01 ELSE ide.valorUnitario END AS valorUnitario,
    d.dataEntrada,
    p.descricao,
    p.nome
  FROM itemdocumentoestoque ide
  JOIN documentoestoque d ON d.id = ide.idDocumentoEstoque
  JOIN produto p ON p.id = ide.idProduto
  WHERE ide.idTipoMovimentacao IN (11, 71, 116, 115, 114, 113, 112, 111, 142)
    AND ide.idSetorEntrada IN (2, 19, 20, 32)
    AND d.dataEntrada >= DATE('{{DATA_ENTRADA_MIN}}')
    AND d.dataEntrada <= DATE('{{DATA_ENTRADA_MAX}}')
    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
),
norm AS (
  SELECT
    b.*,
    REPLACE(
      CASE
        WHEN UPPER(b.descricao) LIKE 'BOBINA%X%MM%' THEN
          CASE
            WHEN LENGTH(b.descricao) - LENGTH(REPLACE(UPPER(b.descricao), 'X', '')) = 1
              THEN CONCAT(TRIM(SUBSTRING_INDEX(UPPER(b.descricao), 'X', 1)),
                          SUBSTRING(UPPER(b.descricao), LOCATE('MM', UPPER(b.descricao)) + 2))
            ELSE CONCAT(LEFT(UPPER(b.descricao), LENGTH(SUBSTRING_INDEX(b.descricao, 'X', 2))),
                        SUBSTRING(UPPER(b.descricao), LOCATE('MM', UPPER(b.descricao)) + 2))
          END
        ELSE ''
      END,
      'BOBINA INTEIRA', 'BOBINA SLITADA'
    ) AS bobina
  FROM base b
),
cunit AS (
  SELECT
    n.idProduto,
    n.nome AS produto,
    n.bobina,
    n.valorUnitario AS valorUnitarioTotal,
    n.dataEntrada,
    n.qtde
  FROM norm n
),
last_by_bobina AS (
  SELECT
    REPLACE(
      CASE
        WHEN UPPER(descricao) LIKE 'BOBINA%X%MM%' THEN
          CASE
            WHEN LENGTH(descricao) - LENGTH(REPLACE(UPPER(descricao), 'X', '')) = 1
              THEN CONCAT(TRIM(SUBSTRING_INDEX(UPPER(descricao), 'X', 1)),
                          SUBSTRING(UPPER(descricao), LOCATE('MM', UPPER(descricao)) + 2))
            ELSE CONCAT(LEFT(UPPER(descricao), LENGTH(SUBSTRING_INDEX(descricao, 'X', 2))),
                        SUBSTRING(UPPER(descricao), LOCATE('MM', UPPER(descricao)) + 2))
          END
        ELSE ''
      END,
      'BOBINA INTEIRA', 'BOBINA SLITADA'
    ) AS bobina,
    MAX(dataEntrada) AS dataEntrada
  FROM base
  WHERE REPLACE(UPPER(descricao), 'INOX', 'INO') LIKE 'BOBINA%X%MM%'
    AND REPLACE(UPPER(descricao), 'INOX', 'INO') NOT LIKE '%ETIQUETA%'
  GROUP BY 1
),
bobin AS (
  SELECT DISTINCT
    n.bobina,
    n.valorUnitario AS valorUnitarioTotal
  FROM norm n
  JOIN last_by_bobina lb
    ON lb.bobina = n.bobina
   AND lb.dataEntrada = n.dataEntrada
),
escolhido AS (
  SELECT
    c.idProduto,
    c.produto,
    CASE
      WHEN c.bobina <> '' AND b.valorUnitarioTotal IS NOT NULL THEN b.valorUnitarioTotal
      ELSE c.valorUnitarioTotal
    END AS valorUnitario,
    c.dataEntrada,
    c.qtde
  FROM cunit c
  LEFT JOIN bobin b ON b.bobina = c.bobina
)
SELECT
  e.idProduto,
  DATE_FORMAT(e.dataEntrada, '%Y-%m-01') AS periodo,
  ROUND(SUM(e.qtde * e.valorUnitario) / NULLIF(SUM(e.qtde), 0), 5) AS custoMedioMensal
FROM escolhido e
WHERE 1=1
  {{ID_PRODUTO_FILTER}}
GROUP BY e.idProduto, DATE_FORMAT(e.dataEntrada, '%Y-%m-01')
HAVING periodo IS NOT NULL
;
