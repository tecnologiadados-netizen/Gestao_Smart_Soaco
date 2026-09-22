-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_provider_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "api_key_encrypted" TEXT NOT NULL,
    "last_tested_at" DATETIME,
    "lastError" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assistente_conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT 'Nova conversa',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assistente_conversa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assistente_mensagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversa_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistente_mensagem_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "assistente_conversa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistente_conversa_usuario_id_updated_at_idx" ON "assistente_conversa"("usuario_id", "updated_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistente_mensagem_conversa_id_created_at_idx" ON "assistente_mensagem"("conversa_id", "created_at");
