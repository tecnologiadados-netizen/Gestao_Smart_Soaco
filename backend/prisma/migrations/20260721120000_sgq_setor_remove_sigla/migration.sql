-- Remover sigla de sgq_setor; unicidade passa a ser pelo nome
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
