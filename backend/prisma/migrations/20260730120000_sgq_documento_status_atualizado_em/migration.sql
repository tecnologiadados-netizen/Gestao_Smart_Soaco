-- Carimbo da última transição de etapa enviado pelo cliente.
-- Permite ao sync descartar snapshots atrasados que reverteriam o workflow.
ALTER TABLE "sgq_documento" ADD COLUMN "statusAtualizadoEm" TEXT;
