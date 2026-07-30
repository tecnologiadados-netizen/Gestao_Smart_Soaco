-- AlterTable
ALTER TABLE "painel_producao_meta" ADD COLUMN "meta_bronze" REAL;
ALTER TABLE "painel_producao_meta" ADD COLUMN "meta_prata" REAL;
ALTER TABLE "painel_producao_meta" ADD COLUMN "meta_aco" REAL;
ALTER TABLE "painel_producao_meta" ADD COLUMN "valor_bronze" REAL;
ALTER TABLE "painel_producao_meta" ADD COLUMN "valor_prata" REAL;
ALTER TABLE "painel_producao_meta" ADD COLUMN "valor_aco" REAL;

-- A meta cadastrada até aqui corresponde ao nível Aço.
UPDATE "painel_producao_meta" SET "meta_aco" = "target" WHERE "meta_aco" IS NULL;

-- Valores fixos por nível conforme a política de bonificação.
UPDATE "painel_producao_meta"
SET "valor_bronze" = 100, "valor_prata" = 150, "valor_aco" = 200
WHERE "setor" IN ('Balcões', 'Bebedouros', 'Fogões', 'Móveis em melamínico', 'Móveis em melaminico');

UPDATE "painel_producao_meta"
SET "valor_bronze" = 20, "valor_prata" = 50, "valor_aco" = 80
WHERE "setor" = 'Cadeiras';

UPDATE "painel_producao_meta"
SET "valor_bronze" = 80, "valor_prata" = 100, "valor_aco" = 120
WHERE "setor" IN ('Móveis de aço', 'Gôndolas');
