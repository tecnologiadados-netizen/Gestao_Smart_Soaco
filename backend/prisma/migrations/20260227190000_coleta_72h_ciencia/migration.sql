-- AlterTable
ALTER TABLE "coleta_precos" ADD COLUMN "dataUltimaMovimentacao" DATETIME;

-- CreateTable
CREATE TABLE "coleta_precos_ciencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coletaPrecosId" INTEGER NOT NULL,
    "justificativa" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coleta_precos_ciencia_coletaPrecosId_fkey" FOREIGN KEY ("coletaPrecosId") REFERENCES "coleta_precos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "coleta_precos_ciencia_coletaPrecosId_idx" ON "coleta_precos_ciencia"("coletaPrecosId");
