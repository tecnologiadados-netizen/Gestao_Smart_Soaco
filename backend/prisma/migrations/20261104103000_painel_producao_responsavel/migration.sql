-- CreateTable
CREATE TABLE "painel_producao_responsavel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mes_ano" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "responsaveis_json" TEXT NOT NULL DEFAULT '[]',
    "atualizado_por" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "painel_producao_responsavel_mes_ano_area_setor_key" ON "painel_producao_responsavel"("mes_ano", "area", "setor");
