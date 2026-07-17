-- Aba CRM Pendências de crédito + config To/Cc + histórico de eventos
CREATE TABLE "crm_credito_pendencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_pedido" INTEGER NOT NULL,
    "numero_pedido" TEXT NOT NULL,
    "cliente_nome" TEXT NOT NULL,
    "cliente_chave" TEXT NOT NULL,
    "status_nomus_snapshot" INTEGER,
    "status_nomus_label" TEXT,
    "acao" TEXT,
    "observacao" TEXT,
    "pedido_destino" TEXT,
    "qtd_titulos_atraso" INTEGER,
    "total_atraso" REAL,
    "maior_atraso_dias" INTEGER,
    "alerta_em" DATETIME NOT NULL,
    "acao_em" DATETIME,
    "acao_por_login" TEXT,
    "acao_por_nome" TEXT,
    "encerrada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "crm_credito_pendencia_id_pedido_key" ON "crm_credito_pendencia"("id_pedido");
CREATE INDEX "crm_credito_pendencia_cliente_chave_idx" ON "crm_credito_pendencia"("cliente_chave");
CREATE INDEX "crm_credito_pendencia_encerrada_alerta_em_idx" ON "crm_credito_pendencia"("encerrada", "alerta_em");
CREATE INDEX "crm_credito_pendencia_acao_idx" ON "crm_credito_pendencia"("acao");

CREATE TABLE "crm_credito_pendencia_evento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pendencia_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhe" TEXT,
    "usuario_login" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_credito_pendencia_evento_pendencia_id_fkey" FOREIGN KEY ("pendencia_id") REFERENCES "crm_credito_pendencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "crm_credito_pendencia_evento_pendencia_id_created_at_idx" ON "crm_credito_pendencia_evento"("pendencia_id", "created_at");

CREATE TABLE "crm_credito_pendencia_email_config" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "destinatarios_to" TEXT NOT NULL DEFAULT '[]',
    "destinatarios_cc" TEXT NOT NULL DEFAULT '[]',
    "updated_at" DATETIME NOT NULL,
    "updated_by_login" TEXT
);

INSERT INTO "crm_credito_pendencia_email_config" ("id", "destinatarios_to", "destinatarios_cc", "updated_at")
SELECT 1, '[]', '[]', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "crm_credito_pendencia_email_config" WHERE "id" = 1);
