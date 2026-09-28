-- Confirma que o FIM da linha Camasi já foi visto ao vivo antes do alerta pós-produção.
ALTER TABLE "camasi_parada_alerta_estado" ADD COLUMN "producao_vista_id" INTEGER;
