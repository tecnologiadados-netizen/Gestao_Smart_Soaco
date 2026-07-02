-- CreateTable
CREATE TABLE "coleta_precos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "coleta_precos_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coletaPrecosId" INTEGER NOT NULL,
    "idProduto" INTEGER NOT NULL,
    CONSTRAINT "coleta_precos_item_coletaPrecosId_fkey" FOREIGN KEY ("coletaPrecosId") REFERENCES "coleta_precos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "coleta_precos_item_coletaPrecosId_idx" ON "coleta_precos_item"("coletaPrecosId");

-- CreateIndex
CREATE INDEX "coleta_precos_item_idProduto_idx" ON "coleta_precos_item"("idProduto");
