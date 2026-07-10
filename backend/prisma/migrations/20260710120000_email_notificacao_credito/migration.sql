-- Tipos de notificação por e-mail (Integração → E-mail)
CREATE TABLE "email_notificacao_tipo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fonteMensagem" TEXT NOT NULL DEFAULT 'codigo',
    "modoDisparo" TEXT NOT NULL DEFAULT 'cron',
    "cronExpressao" TEXT,
    "builderCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "email_notificacao_destinatario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "email_notificacao_destinatario_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "email_notificacao_tipo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_notificacao_destinatario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "email_notificacao_tipo_code_key" ON "email_notificacao_tipo"("code");
CREATE UNIQUE INDEX "email_notificacao_destinatario_tipoId_usuarioId_key" ON "email_notificacao_destinatario"("tipoId", "usuarioId");

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
    'financeiro_credito_pedido_atraso',
    'Alerta de crédito — pendência em atraso com pedido aberto',
    'Envia e-mail quando um cliente com pedido de venda em aberto (aguardando liberação, liberado ou atendido parcialmente) possui contas a receber em atraso.',
    true,
    10,
    'codigo',
    'cron',
    '0 8 * * *',
    'financeiro_credito_pedido_atraso',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'financeiro_credito_pedido_atraso'
);
