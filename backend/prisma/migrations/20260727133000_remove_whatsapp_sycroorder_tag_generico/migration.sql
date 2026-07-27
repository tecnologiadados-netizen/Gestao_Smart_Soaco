-- Remove alertas genéricos substituídos por Loja / Indústria.
-- Destinatários são apagados em cascata (whatsapp_notificacao_destinatario).

DELETE FROM "whatsapp_notificacao_tipo"
WHERE "code" IN ('sycroorder_tag_disponivel', 'sycroorder_tag_indisponivel');
