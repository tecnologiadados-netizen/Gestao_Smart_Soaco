-- CreateTable
CREATE TABLE "notificacao_execucao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "canal" TEXT NOT NULL,
    "tipo_code" TEXT NOT NULL,
    "tipo_id" INTEGER,
    "origem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "iniciado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" DATETIME,
    "resumo" TEXT,
    "erro_mensagem" TEXT,
    "metadados_json" TEXT
);

-- CreateTable
CREATE TABLE "notificacao_tentativa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "execucao_id" INTEGER NOT NULL,
    "canal" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "enviado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificacao_tentativa_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "notificacao_execucao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notificacao_execucao_canal_tipo_code_iniciado_em_idx" ON "notificacao_execucao"("canal", "tipo_code", "iniciado_em");

-- CreateIndex
CREATE INDEX "notificacao_execucao_tipo_id_iniciado_em_idx" ON "notificacao_execucao"("tipo_id", "iniciado_em");

-- CreateIndex
CREATE INDEX "notificacao_tentativa_execucao_id_idx" ON "notificacao_tentativa"("execucao_id");
