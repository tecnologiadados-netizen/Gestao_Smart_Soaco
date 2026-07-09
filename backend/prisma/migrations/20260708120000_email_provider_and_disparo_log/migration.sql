-- CreateTable
CREATE TABLE "email_provider_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'gmail_api',
    "from_email" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "last_tested_at" DATETIME,
    "lastError" TEXT,
    "credential_blocked_at" DATETIME,
    "credential_block_code" TEXT,
    "credential_block_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "email_disparo_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "enviado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "email_disparo_log_chave_key" ON "email_disparo_log"("chave");

-- CreateIndex
CREATE INDEX "email_disparo_log_categoria_enviado_em_idx" ON "email_disparo_log"("categoria", "enviado_em");
