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
    'financeiro_credito_resumo_diario',
    'Alerta de crédito — resumo diário (inadimplentes, regularizados e ações)',
    'Envia um único e-mail no fim do dia útil com o compilado de clientes inadimplentes, regularizados aguardando liberação, finalizados no dia e ações confirmadas no Nomus (com códigos dos PDs). Não envia se não houver conteúdo.',
    true,
    30,
    'codigo',
    'cron',
    '30 17 * * 1-5',
    'financeiro_credito_resumo_diario',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'financeiro_credito_resumo_diario'
);
