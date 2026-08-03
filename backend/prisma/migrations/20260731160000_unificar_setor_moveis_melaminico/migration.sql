-- Unifica "Móveis em melaminico" (sem acento) em "Móveis em melamínico".
-- Quando as duas grafias existem no mesmo mês, remove a sem acento.

DELETE FROM "painel_producao_meta"
WHERE "id" IN (
  SELECT a."id"
  FROM "painel_producao_meta" AS a
  INNER JOIN "painel_producao_meta" AS b
    ON b."mes_ano" = a."mes_ano"
   AND b."setor" = 'Móveis em melamínico'
  WHERE a."setor" = 'Móveis em melaminico'
);

UPDATE "painel_producao_meta"
SET "setor" = 'Móveis em melamínico'
WHERE "setor" = 'Móveis em melaminico';
