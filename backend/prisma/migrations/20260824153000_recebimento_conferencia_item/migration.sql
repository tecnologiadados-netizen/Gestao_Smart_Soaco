-- Linhas digitadas pelo conferente (código + quantidade física).
CREATE TABLE "recebimento_conferencia_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conferenciaId" INTEGER NOT NULL,
    "codigoInformado" TEXT NOT NULL,
    "qtdeInformada" REAL NOT NULL,
    "idItemDocumento" INTEGER,
    "idProduto" INTEGER,
    "descricaoProduto" TEXT,
    "unidadeMedida" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recebimento_conferencia_item_conferenciaId_fkey"
      FOREIGN KEY ("conferenciaId") REFERENCES "recebimento_conferencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "recebimento_conferencia_item_conferenciaId_idx"
  ON "recebimento_conferencia_item"("conferenciaId");
