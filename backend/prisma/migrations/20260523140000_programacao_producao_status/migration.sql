-- Status workflow (mesmo padrão Ressup Almox)
ALTER TABLE "programacao_producao_registro" ADD COLUMN "linhaCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "programacao_producao_registro" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'em_processamento';
ALTER TABLE "programacao_producao_registro" ADD COLUMN "processadoAt" DATETIME;
ALTER TABLE "programacao_producao_registro" ADD COLUMN "usuarioLoginProcessado" TEXT;
ALTER TABLE "programacao_producao_registro" ADD COLUMN "concluidoAt" DATETIME;
ALTER TABLE "programacao_producao_registro" ADD COLUMN "usuarioLoginConcluido" TEXT;
CREATE INDEX "programacao_producao_registro_status_idx" ON "programacao_producao_registro"("status");
