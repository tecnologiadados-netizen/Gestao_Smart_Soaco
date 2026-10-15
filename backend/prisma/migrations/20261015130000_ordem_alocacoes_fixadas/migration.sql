-- Marca a ordem cuja lista de pedidos já foi decidida no Salvar.
-- Ordem antiga sem essa marca ainda recebe o retrato na primeira abertura.
ALTER TABLE "decomposicao_ordem" ADD COLUMN "alocacoesFixadas" BOOLEAN NOT NULL DEFAULT 0;
