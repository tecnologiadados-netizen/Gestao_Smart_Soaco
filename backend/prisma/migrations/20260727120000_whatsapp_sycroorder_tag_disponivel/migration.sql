-- Tipos SMS (evento): card Comunicação PD marcado como Disponível / Não disponível
INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_disponivel',
  'Card marcado como Disponível',
  'Enviada quando um card da Comunicação PD é marcado como DISPONÍVEL.',
  1,
  25,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_disponivel'
);

INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_indisponivel',
  'Card marcado como Não disponível',
  'Enviada quando um card da Comunicação PD, antes disponível, é marcado como NÃO DISPONÍVEL.',
  1,
  26,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_indisponivel'
);
