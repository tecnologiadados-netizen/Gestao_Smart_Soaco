-- E-mails avisados quando o card muda (JSON: ["a@x.com", ...]).
ALTER TABLE "rh_demanda_card" ADD COLUMN "emails_notificacao" TEXT NOT NULL DEFAULT '[]';

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
    'rh_demanda_card_alteracao',
    'Demandas Internas — alteração de card',
    'Envia e-mail quando um card das Demandas Internas muda de lista ou quadro, é concluído ou reaberto, tem prazo, título, observação, checklist ou prints alterados, ou é excluído. Os destinatários são os e-mails informados em cada card (campo "Notificar por e-mail"); os destinatários deste alerta servem só para o teste de envio.',
    true,
    41,
    'codigo',
    'evento',
    NULL,
    'rh_demanda_card_alteracao',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'rh_demanda_card_alteracao'
);
