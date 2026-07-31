-- Soft-archive: preserva rascunhos/histórico ao sair da carência ou do alerta.
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "arquivada_em" DATETIME;
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "motivo_arquivo" TEXT;
CREATE INDEX "crm_credito_pendencia_arquivada_em_idx" ON "crm_credito_pendencia"("arquivada_em");
