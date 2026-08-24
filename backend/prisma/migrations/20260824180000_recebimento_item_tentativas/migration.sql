-- Tentativas (3 chances) por item do documento.
ALTER TABLE "recebimento_conferencia_item" ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recebimento_conferencia_item" ADD COLUMN "conferido" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "recebimento_conferencia_item_conferenciaId_idItemDocumento_key"
  ON "recebimento_conferencia_item"("conferenciaId", "idItemDocumento");
