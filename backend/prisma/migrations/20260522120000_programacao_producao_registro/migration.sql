-- CreateTable
CREATE TABLE "programacao_producao_registro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dadosJson" TEXT NOT NULL,
    "criadoPorLogin" TEXT NOT NULL,
    "criadoPorNome" TEXT,
    "atualizadoPorLogin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "programacao_producao_registro_uid_key" ON "programacao_producao_registro"("uid");

-- CreateIndex
CREATE INDEX "programacao_producao_registro_criadoPorLogin_idx" ON "programacao_producao_registro"("criadoPorLogin");

-- CreateIndex
CREATE INDEX "programacao_producao_registro_updatedAt_idx" ON "programacao_producao_registro"("updatedAt");
