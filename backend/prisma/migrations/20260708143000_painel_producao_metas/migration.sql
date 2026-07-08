-- CreateTable
CREATE TABLE "painel_producao_meta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setor" TEXT NOT NULL,
    "mes_ano" TEXT NOT NULL,
    "target" REAL NOT NULL,
    "sem_meta" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "painel_producao_mes" (
    "mes_ano" TEXT NOT NULL PRIMARY KEY,
    "origem" TEXT NOT NULL DEFAULT 'auto',
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "painel_producao_meta_setor_mes_ano_key" ON "painel_producao_meta"("setor", "mes_ano");
