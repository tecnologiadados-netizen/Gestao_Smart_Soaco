-- Corrige JOINs antigos Nomus (idDocumentoSaida/idDocumentoEntrada) em SQL customizado
-- de tipos SMS/WhatsApp (fonteMensagem = sql_template).
UPDATE whatsapp_notificacao_tipo
SET
  sqlNomus = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(sqlNomus, 'ide.idDocumentoSaida = de.id', 'ide.idDocumentoEstoque = de.id'),
        'ide.idDocumentoEntrada = de.id',
        'ide.idDocumentoEstoque = de.id'
      ),
      'de.id = ide.idDocumentoSaida',
      'de.id = ide.idDocumentoEstoque'
    ),
    'de.id = ide.idDocumentoEntrada',
    'de.id = ide.idDocumentoEstoque'
  ),
  updatedAt = CURRENT_TIMESTAMP
WHERE sqlNomus IS NOT NULL
  AND (
    sqlNomus LIKE '%idDocumentoSaida%'
    OR sqlNomus LIKE '%idDocumentoEntrada%'
  );
