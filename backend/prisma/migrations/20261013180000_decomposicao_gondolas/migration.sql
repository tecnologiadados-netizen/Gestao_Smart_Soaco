-- Cadastro local da decomposição de gôndolas e porta-pallets.
CREATE TABLE IF NOT EXISTS "decomposicao_produto_pai" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoPorLogin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "decomposicao_produto_pai_codigo_key"
  ON "decomposicao_produto_pai"("codigo");

CREATE TABLE IF NOT EXISTS "decomposicao_produto_filho" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paiId" INTEGER NOT NULL,
    "codigoNomus" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "decomposicao_produto_filho_paiId_fkey"
      FOREIGN KEY ("paiId") REFERENCES "decomposicao_produto_pai" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "decomposicao_produto_filho_paiId_codigoNomus_key"
  ON "decomposicao_produto_filho"("paiId", "codigoNomus");

CREATE INDEX IF NOT EXISTS "decomposicao_produto_filho_codigoNomus_idx"
  ON "decomposicao_produto_filho"("codigoNomus");
