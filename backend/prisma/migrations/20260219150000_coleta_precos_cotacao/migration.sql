-- CreateTable
CREATE TABLE "coleta_precos_cotacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coletaPrecosId" INTEGER NOT NULL,
    "idProduto" INTEGER NOT NULL,
    "idFornecedor" INTEGER NOT NULL,
    "precoNF" REAL NOT NULL,
    "percICMS" REAL NOT NULL,
    "percPIS" REAL NOT NULL,
    "percIPI" REAL NOT NULL,
    "percCOFINS" REAL NOT NULL,
    "precoTotal" REAL NOT NULL,
    CONSTRAINT "coleta_precos_cotacao_coletaPrecosId_fkey" FOREIGN KEY ("coletaPrecosId") REFERENCES "coleta_precos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "coleta_precos_cotacao_coletaPrecosId_idProduto_idFornecedor_key" ON "coleta_precos_cotacao"("coletaPrecosId", "idProduto", "idFornecedor");

-- CreateIndex
CREATE INDEX "coleta_precos_cotacao_coletaPrecosId_idx" ON "coleta_precos_cotacao"("coletaPrecosId");

-- CreateIndex
CREATE INDEX "coleta_precos_cotacao_idProduto_idx" ON "coleta_precos_cotacao"("idProduto");
