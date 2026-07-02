-- Critério de disparo: Previsão atual ≤ hoje (card no Comunicador de Pedidos)
UPDATE "whatsapp_notificacao_tipo"
SET
  "label" = 'Pedidos com previsão de entrega vencida',
  "descricao" = 'Enviada automaticamente com pedidos Entrega G. The e Retirada (card no Comunicador) cuja Previsão atual é igual ou anterior a hoje (bolinha verde/vermelha conforme Comunicação PD).',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'pedidos_entrega_vencida';
