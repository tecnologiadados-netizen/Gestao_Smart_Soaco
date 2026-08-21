-- Double CheckIn: dedup de alertas WhatsApp por documento de entrada (Nomus).
CREATE TABLE "double_checkin_alerta_enviado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "enviadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumo" TEXT
);

CREATE UNIQUE INDEX "double_checkin_alerta_enviado_idDocumentoEstoque_key"
  ON "double_checkin_alerta_enviado"("idDocumentoEstoque");

-- Limiar percentual padrão (±10%).
INSERT OR IGNORE INTO "config" ("key", "value")
VALUES ('double_checkin_limiar_pct', '10');

-- Tipo WhatsApp evento para alertas da tela.
INSERT INTO "whatsapp_notificacao_tipo"
  ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'compras_double_checkin',
  'Double CheckIn — variação de preço',
  'Enviada quando uma NF de entrada nova tem item com variação de preço acima do limiar configurado.',
  1,
  45,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'compras_double_checkin'
);
