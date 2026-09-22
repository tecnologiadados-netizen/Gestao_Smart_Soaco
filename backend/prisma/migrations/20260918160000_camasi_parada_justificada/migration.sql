-- CreateTable
CREATE TABLE "camasi_justificativa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "camasi_justificativa_nome_key" ON "camasi_justificativa"("nome");

-- CreateTable
CREATE TABLE "camasi_parada_justificada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" TEXT NOT NULL,
    "inicio_parado" TEXT NOT NULL,
    "fim_parado" TEXT NOT NULL,
    "observacao_origem" TEXT NOT NULL DEFAULT '',
    "nome" TEXT NOT NULL,
    "usuario_login" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "camasi_parada_justificada_data_inicio_parado_fim_parado_observacao_origem_key"
ON "camasi_parada_justificada"("data", "inicio_parado", "fim_parado", "observacao_origem");

-- CreateIndex
CREATE INDEX "camasi_parada_justificada_data_idx" ON "camasi_parada_justificada"("data");
