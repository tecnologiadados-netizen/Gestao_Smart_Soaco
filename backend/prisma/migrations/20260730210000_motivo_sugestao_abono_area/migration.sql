-- Classificação obrigatória das justificativas para a apuração de metas.
ALTER TABLE "MotivoSugestao" ADD COLUMN "abonada" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "MotivoSugestao" ADD COLUMN "aplicacao_nao_abonada" TEXT;

-- Preserva as duas regras qualitativas que já eram consideradas pela apuração.
UPDATE "MotivoSugestao"
SET "abonada" = 0, "aplicacao_nao_abonada" = 'montagem'
WHERE "descricao" = 'Estimativa de entrega passada pela produção equivocada';

UPDATE "MotivoSugestao"
SET "abonada" = 0, "aplicacao_nao_abonada" = 'producao'
WHERE "descricao" = 'Reprogramação devido a ruptura no estoque de PP';
