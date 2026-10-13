-- Matéria-prima do vínculo: produto em processo (PP) da lista de materiais do filho.
ALTER TABLE "decomposicao_produto_filho" ADD COLUMN "materiaPrimaCodigo" TEXT;
ALTER TABLE "decomposicao_produto_filho" ADD COLUMN "materiaPrimaDescricao" TEXT;
