-- CreateTable
CREATE TABLE "whatsapp_notificacao_tipo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fonteMensagem" TEXT NOT NULL DEFAULT 'evento',
    "modoDisparo" TEXT NOT NULL DEFAULT 'evento',
    "cronExpressao" TEXT,
    "sqlNomus" TEXT,
    "templateMensagem" TEXT,
    "builderCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_notificacao_destinatario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "whatsapp_notificacao_destinatario_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "whatsapp_notificacao_tipo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whatsapp_notificacao_destinatario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_notificacao_tipo_code_key" ON "whatsapp_notificacao_tipo"("code");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_notificacao_destinatario_tipoId_usuarioId_key" ON "whatsapp_notificacao_destinatario"("tipoId", "usuarioId");

-- Seed tipos iniciais
INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
VALUES
  ('previsao_alteracao', 'Alteração de previsão de entrega', 'Enviada quando a previsão de entrega de um pedido é ajustada no Gerenciador.', 1, 10, 'evento', 'evento', NULL, NULL, CURRENT_TIMESTAMP),
  ('sycroorder_novo_pedido', 'Novo pedido SycroOrder', 'Enviada quando um novo pedido é registrado na Comunicação PD.', 1, 20, 'evento', 'evento', NULL, NULL, CURRENT_TIMESTAMP),
  ('faturamento_diario', 'Faturamento diário', 'Enviada automaticamente às 18h com resumo do faturamento do dia.', 1, 30, 'codigo', 'cron', '0 18 * * *', 'faturamento_diario', CURRENT_TIMESTAMP);
