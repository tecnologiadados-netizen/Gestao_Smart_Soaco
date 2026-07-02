-- Snapshot de análises Ressup Não Almox (grade + dados Nomus)
CREATE TABLE "ressup_nao_almox_analise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioLogin" TEXT NOT NULL,
    "resumoFiltros" TEXT,
    "linhaCount" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'em_processamento',
    "processadoAt" DATETIME,
    "usuarioLoginProcessado" TEXT,
    "concluidoAt" DATETIME,
    "usuarioLoginConcluido" TEXT
);

CREATE INDEX "ressup_nao_almox_analise_createdAt_idx" ON "ressup_nao_almox_analise"("createdAt");
CREATE INDEX "ressup_nao_almox_analise_status_idx" ON "ressup_nao_almox_analise"("status");
