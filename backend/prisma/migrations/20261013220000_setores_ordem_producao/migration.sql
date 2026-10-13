-- Setores livres da ordem de produção. O produto deixa de ficar preso a dois grupos.
CREATE TABLE IF NOT EXISTS "decomposicao_setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "decomposicao_setor_nome_key" ON "decomposicao_setor"("nome");

UPDATE "decomposicao_produto_pai" SET "grupo" = 'GÔNDOLAS' WHERE "grupo" = 'gondolas';
UPDATE "decomposicao_produto_pai" SET "grupo" = 'PORTA-PALLETS' WHERE "grupo" = 'porta_pallets';
UPDATE "decomposicao_ordem" SET "grupo" = 'GÔNDOLAS' WHERE "grupo" = 'gondolas';
UPDATE "decomposicao_ordem" SET "grupo" = 'PORTA-PALLETS' WHERE "grupo" = 'porta_pallets';

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT DISTINCT "grupo", 0
FROM "decomposicao_produto_pai"
WHERE TRIM("grupo") <> ''
  AND "grupo" NOT IN (SELECT "nome" FROM "decomposicao_setor");

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT DISTINCT "grupo", 0
FROM "decomposicao_ordem"
WHERE TRIM("grupo") <> ''
  AND "grupo" NOT IN (SELECT "nome" FROM "decomposicao_setor");
