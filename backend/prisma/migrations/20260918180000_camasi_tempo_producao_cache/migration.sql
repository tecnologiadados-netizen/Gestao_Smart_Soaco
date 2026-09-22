-- CreateTable
CREATE TABLE IF NOT EXISTS "camasi_tempo_producao" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "inicio_producao" TEXT,
    "fim_producao" TEXT,
    "inicio_parado" TEXT,
    "fim_parado" TEXT,
    "motivo_parado" TEXT,
    "nome_motivo" TEXT,
    "obs_motivo" TEXT,
    "operador" TEXT,
    "nome_operador" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "camasi_tempo_producao_data_idx" ON "camasi_tempo_producao"("data");

-- CreateTable
CREATE TABLE IF NOT EXISTS "camasi_sync_estado" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "last_success_at" DATETIME,
    "last_attempt_at" DATETIME,
    "last_error" TEXT,
    "last_rows_upserted" INTEGER NOT NULL DEFAULT 0,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "full_sync_done" BOOLEAN NOT NULL DEFAULT false,
    "modo_ultimo_sync" TEXT
);
