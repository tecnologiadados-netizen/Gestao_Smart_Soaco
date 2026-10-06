-- Motivo de divergência passa a guardar os campos em que aparece na conferência.
ALTER TABLE "double_checkin_justificativa_opcao" ADD COLUMN "campos" TEXT NOT NULL DEFAULT '';
