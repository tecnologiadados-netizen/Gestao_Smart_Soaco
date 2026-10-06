ALTER TABLE "recebimento_conferencia" ADD COLUMN "mesaUltimaAcao" TEXT;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "mesaAcaoEm" DATETIME;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "mesaAcaoPorUsuarioId" INTEGER;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "mesaAcaoPorLogin" TEXT;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "idDocumentoDevolucaoNomus" INTEGER;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "numeroDocumentoDevolucao" TEXT;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "numeroNfeDevolucao" TEXT;
ALTER TABLE "recebimento_conferencia" ADD COLUMN "devolucaoVinculadaEm" DATETIME;

CREATE TABLE "recebimento_conferencia_ciclo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conferenciaId" INTEGER NOT NULL,
    "statusRetorno" TEXT NOT NULL,
    "conferenteUsuarioId" INTEGER,
    "conferenteLogin" TEXT,
    "conferenteNome" TEXT,
    "atribuidoEm" DATETIME,
    "finalizadoEm" DATETIME,
    "itensJson" TEXT NOT NULL,
    "arquivadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recebimento_conferencia_ciclo_conferenciaId_fkey"
      FOREIGN KEY ("conferenciaId") REFERENCES "recebimento_conferencia" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "recebimento_conferencia_ciclo_conferenciaId_arquivadoEm_idx"
  ON "recebimento_conferencia_ciclo"("conferenciaId", "arquivadoEm");
