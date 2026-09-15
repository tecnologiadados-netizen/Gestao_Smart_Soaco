-- CreateTable
CREATE TABLE IF NOT EXISTS "assistente_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" INTEGER NOT NULL,
    "conversa_id" TEXT NOT NULL,
    "mensagem_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pergunta_usuario" TEXT,
    "resposta_assistente" TEXT NOT NULL,
    "pathname" TEXT,
    "titulo_conversa" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido_em" DATETIME,
    "resolvido_por_usuario_id" INTEGER,
    "nota_interna" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assistente_feedback_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assistente_feedback_mensagem_id_fkey" FOREIGN KEY ("mensagem_id") REFERENCES "assistente_mensagem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "assistente_feedback_mensagem_id_key" ON "assistente_feedback"("mensagem_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistente_feedback_tipo_resolvido_created_at_idx" ON "assistente_feedback"("tipo", "resolvido", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistente_feedback_usuario_id_idx" ON "assistente_feedback"("usuario_id");
