-- Tipo SMS: pedidos com previsão de entrega vencida (cron 17:30)
INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'pedidos_entrega_vencida',
  'Pedidos com previsão vencida',
  'Enviada automaticamente às 17:30 com pedidos cuja Previsão atual é igual ou anterior a hoje (Entrega G. The e Retirada).',
  1,
  40,
  'codigo',
  'cron',
  '30 17 * * *',
  'pedidos_entrega_vencida',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'pedidos_entrega_vencida'
);
