-- Exemplos de produto usados para identificar o setor da reclamação.
ALTER TABLE "sgq_reclamacao_produto" ADD COLUMN "exemplosJson" TEXT NOT NULL DEFAULT '[]';
