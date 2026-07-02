-- Remove todos os dados relacionados à coleta de preços (apenas essas tabelas).
-- Ordem: tabelas filhas primeiro (cotação, registro, item), depois a principal.
DELETE FROM "coleta_precos_cotacao";
DELETE FROM "coleta_precos_registro";
DELETE FROM "coleta_precos_item";
DELETE FROM "coleta_precos";

-- Reinicia os contadores de ID (autoincrement) no SQLite para que a próxima coleta seja #1.
DELETE FROM "sqlite_sequence" WHERE name IN ('coleta_precos', 'coleta_precos_item', 'coleta_precos_registro', 'coleta_precos_cotacao');
