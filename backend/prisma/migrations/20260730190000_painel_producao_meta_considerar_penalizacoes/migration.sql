-- Flag de penalização passa a ser por setor+mês (cadastro de metas).
ALTER TABLE "painel_producao_meta" ADD COLUMN "considerar_penalizacoes" BOOLEAN NOT NULL DEFAULT 1;

-- Replica o valor que estava no mês (se existir) para as linhas daquele período.
UPDATE "painel_producao_meta"
SET "considerar_penalizacoes" = COALESCE(
  (
    SELECT m."considerar_penalizacoes"
    FROM "painel_producao_mes" m
    WHERE m."mes_ano" = "painel_producao_meta"."mes_ano"
  ),
  1
);

-- Coluna antiga no mês deixa de ser usada (SQLite não dropa com segurança aqui).
