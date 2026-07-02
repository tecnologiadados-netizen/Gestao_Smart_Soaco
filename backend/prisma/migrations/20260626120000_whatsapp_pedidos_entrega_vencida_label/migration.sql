-- Atualiza rótulo/descrição do SMS pedidos_entrega_vencida (critério: Data original)
UPDATE "whatsapp_notificacao_tipo"
SET
  "label" = 'Pedidos com data de entrega vencida',
  "descricao" = 'Enviada automaticamente com pedidos Entrega G. The e Retirada cuja Data original é igual ou anterior a hoje (bolinha verde/vermelha conforme Comunicação PD).',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'pedidos_entrega_vencida';
