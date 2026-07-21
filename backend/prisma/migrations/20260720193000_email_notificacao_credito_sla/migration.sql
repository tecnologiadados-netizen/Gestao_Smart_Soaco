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
    'financeiro_credito_sla_sem_acao',
    'Alerta de crédito — prazo de ação estourado (PD em carteira)',
    'Envia e-mail ao gestor quando um pedido na aba Pendências de crédito com PD em carteira fica sem ação além do prazo configurado (horas na própria aba). Configure aqui dias, horários e destinatários.',
    true,
    25,
    'codigo',
    'cron',
    '15 * * * *',
    'financeiro_credito_sla_sem_acao',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'financeiro_credito_sla_sem_acao'
);
