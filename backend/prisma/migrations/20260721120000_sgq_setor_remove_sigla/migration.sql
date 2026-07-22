-- Remover sigla de sgq_setor; unicidade passa a ser pelo nome.
-- Antes: deduplica nomes (havia setores repetidos) e remapeia setorUid.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1) Mapa: uids duplicados -> uid a manter (menor id por nome)
CREATE TABLE IF NOT EXISTS "_sgq_setor_remap" (
    "from_uid" TEXT NOT NULL,
    "to_uid" TEXT NOT NULL
);

DELETE FROM "_sgq_setor_remap";

INSERT INTO "_sgq_setor_remap" ("from_uid", "to_uid")
SELECT s.uid, k.uid
FROM "sgq_setor" s
INNER JOIN (
    SELECT "nome", MIN("id") AS keep_id
    FROM "sgq_setor"
    GROUP BY "nome"
) keep ON keep."nome" = s."nome" AND keep.keep_id <> s."id"
INNER JOIN "sgq_setor" k ON k."id" = keep.keep_id;

-- 2) Remapear referências (só se a tabela existir — SQLite ignora via try em ambientes limpos)
UPDATE "sgq_documento"
SET "setorUid" = (
    SELECT r."to_uid" FROM "_sgq_setor_remap" r WHERE r."from_uid" = "sgq_documento"."setorUid"
)
WHERE "setorUid" IN (SELECT "from_uid" FROM "_sgq_setor_remap");

UPDATE "sgq_equipamento"
SET "setorUid" = (
    SELECT r."to_uid" FROM "_sgq_setor_remap" r WHERE r."from_uid" = "sgq_equipamento"."setorUid"
)
WHERE "setorUid" IN (SELECT "from_uid" FROM "_sgq_setor_remap");

-- 3) Remover setores duplicados (mantém o de menor id)
DELETE FROM "sgq_setor"
WHERE "id" NOT IN (
    SELECT MIN("id") FROM "sgq_setor" GROUP BY "nome"
);

DROP TABLE IF EXISTS "_sgq_setor_remap";

-- 4) Recriar tabela sem coluna sigla (idempotente se sigla já não existir)
CREATE TABLE "new_sgq_setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_sgq_setor" ("id", "uid", "nome", "ativo", "createdAt", "updatedAt")
SELECT "id", "uid", "nome", "ativo", "createdAt", "updatedAt" FROM "sgq_setor";

DROP TABLE "sgq_setor";
ALTER TABLE "new_sgq_setor" RENAME TO "sgq_setor";

CREATE UNIQUE INDEX "sgq_setor_uid_key" ON "sgq_setor"("uid");
CREATE UNIQUE INDEX "sgq_setor_nome_key" ON "sgq_setor"("nome");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
