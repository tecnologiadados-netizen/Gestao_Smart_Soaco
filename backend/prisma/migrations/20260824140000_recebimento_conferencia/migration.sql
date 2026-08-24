-- Recebimento: andamento local da conferência às cegas (DE de pré-entrada Nomus).
CREATE TABLE "recebimento_conferencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "numeroDocumento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_CONFERENTE',
    "conferenteUsuarioId" INTEGER,
    "conferenteLogin" TEXT,
    "conferenteNome" TEXT,
    "atribuidoEm" DATETIME,
    "atribuidoPorUsuarioId" INTEGER,
    "atribuidoPorLogin" TEXT,
    "iniciadoEm" DATETIME,
    "finalizadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "recebimento_conferencia_idDocumentoEstoque_key"
  ON "recebimento_conferencia"("idDocumentoEstoque");

CREATE INDEX "recebimento_conferencia_status_idx"
  ON "recebimento_conferencia"("status");

CREATE INDEX "recebimento_conferencia_conferenteUsuarioId_idx"
  ON "recebimento_conferencia"("conferenteUsuarioId");
