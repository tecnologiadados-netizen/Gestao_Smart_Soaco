-- CreateTable
CREATE TABLE "regra_data_entrega_versao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vigenteApartirDe" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "criadoPorLogin" TEXT NOT NULL,
    "criadoPorNome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "regra_data_entrega_versao_vigenteApartirDe_idx" ON "regra_data_entrega_versao"("vigenteApartirDe");
