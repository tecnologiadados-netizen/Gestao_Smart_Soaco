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
    'rh_organico_comentario_sensivel',
    'Orgânico — comentário sensível ou confidencial',
    'Envia e-mail no momento em que um comentário é gravado no card do colaborador (Orgânico) com tom Sensível ou visibilidade Confidencial. Configure os destinatários neste alerta.',
    true,
    40,
    'codigo',
    'evento',
    NULL,
    'rh_organico_comentario_sensivel',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "email_notificacao_tipo" WHERE "code" = 'rh_organico_comentario_sensivel'
);
