-- CreateTable
CREATE TABLE "coleta_precos_registro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coletaPrecosId" INTEGER NOT NULL,
    "idProduto" INTEGER NOT NULL,
    "dados" TEXT NOT NULL,
    CONSTRAINT "coleta_precos_registro_coletaPrecosId_fkey" FOREIGN KEY ("coletaPrecosId") REFERENCES "coleta_precos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "coleta_precos_registro_coletaPrecosId_idx" ON "coleta_precos_registro"("coletaPrecosId");

-- CreateIndex
CREATE INDEX "coleta_precos_registro_idProduto_idx" ON "coleta_precos_registro"("idProduto");
