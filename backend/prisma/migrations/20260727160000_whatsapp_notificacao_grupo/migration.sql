-- Grupos WhatsApp por tipo de alerta (Integração → SMS)
CREATE TABLE IF NOT EXISTS "whatsapp_notificacao_grupo" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tipoId" INTEGER NOT NULL,
  "jid" TEXT NOT NULL,
  "nome" TEXT,
  CONSTRAINT "whatsapp_notificacao_grupo_tipoId_fkey"
    FOREIGN KEY ("tipoId") REFERENCES "whatsapp_notificacao_tipo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_notificacao_grupo_tipoId_jid_key"
  ON "whatsapp_notificacao_grupo"("tipoId", "jid");

CREATE INDEX IF NOT EXISTS "whatsapp_notificacao_grupo_tipoId_idx"
  ON "whatsapp_notificacao_grupo"("tipoId");
