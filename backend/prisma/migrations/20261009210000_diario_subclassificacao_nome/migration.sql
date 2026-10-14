-- O cadastro passa a ser pelo nome da classificação, não pela origem e pelo código.
DROP TABLE IF EXISTS "diario_subclassificacao";

CREATE TABLE "diario_subclassificacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "classificacao" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "diario_subclassificacao_chave_key" ON "diario_subclassificacao"("chave");
