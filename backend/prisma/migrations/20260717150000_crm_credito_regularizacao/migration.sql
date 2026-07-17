-- CreateTable
CREATE TABLE "crm_credito_regularizacao_monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cliente_nome" TEXT NOT NULL,
    "cliente_chave" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'MONITORANDO',
    "iniciado_em" DATETIME NOT NULL,
    "regularizado_em" DATETIME,
    "email_enviado_em" DATETIME,
    "iniciado_por_login" TEXT,
    "iniciado_por_nome" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "crm_credito_regularizacao_titulo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monitor_id" INTEGER NOT NULL,
    "codigo_conta" INTEGER NOT NULL,
    "data_vencimento" TEXT,
    "valor_referencia" REAL NOT NULL,
    "nfe_origem" TEXT,
    "descricao" TEXT,
    "dias_atraso_snap" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "regularizado_em" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "crm_credito_regularizacao_titulo_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "crm_credito_regularizacao_monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "crm_credito_regularizacao_monitor_cliente_chave_situacao_idx" ON "crm_credito_regularizacao_monitor"("cliente_chave", "situacao");

-- CreateIndex
CREATE INDEX "crm_credito_regularizacao_monitor_situacao_regularizado_em_idx" ON "crm_credito_regularizacao_monitor"("situacao", "regularizado_em");

-- CreateIndex
CREATE UNIQUE INDEX "crm_credito_regularizacao_titulo_monitor_id_codigo_conta_key" ON "crm_credito_regularizacao_titulo"("monitor_id", "codigo_conta");

-- CreateIndex
CREATE INDEX "crm_credito_regularizacao_titulo_monitor_id_status_idx" ON "crm_credito_regularizacao_titulo"("monitor_id", "status");

-- Tipo de e-mail: alerta de cliente regularizado após pausa
INSERT INTO "email_notificacao_tipo" (
    "code",
    "label",
    "descricao",
    "ativo",
    "sortOrder",
    "fonteMensagem",
    "modoDisparo",
    "cronExpressao",
    "builderCode",
    "updatedAt"
)
SELECT
    'financeiro_credito_cliente_regularizado',
    'Alerta de crédito — cliente regularizado após pausa do pedido',
    'Envia e-mail quando um cliente com pedido pausado (aguardando liberação) zera os títulos em atraso. Destinado à analista de crédito para avaliar liberação no Nomus.',
    true,
    20,
    'codigo',
    'cron',
    '0 9 * * 1-5',
    'financeiro_credito_cliente_regularizado',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'financeiro_credito_cliente_regularizado'
);
