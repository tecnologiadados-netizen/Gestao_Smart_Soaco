-- CreateTable
CREATE TABLE "MotivoSugestao" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "descricao" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MotivoSugestao_descricao_key" ON "MotivoSugestao"("descricao");

-- AddColumn
ALTER TABLE "pedido_previsao_ajuste" ADD COLUMN "observacao" TEXT;

