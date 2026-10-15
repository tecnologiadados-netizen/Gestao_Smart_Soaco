CREATE TABLE IF NOT EXISTS "diario_subclassificacao_catalogo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_subclassificacao_catalogo_chave_key"
  ON "diario_subclassificacao_catalogo"("chave");
