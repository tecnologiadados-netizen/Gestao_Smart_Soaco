-- Medida de corte e observação digitadas na geração da ordem, copiadas para o PDF.
ALTER TABLE "decomposicao_ordem_peca" ADD COLUMN "medidaCorte" TEXT NOT NULL DEFAULT '';
ALTER TABLE "decomposicao_ordem_peca" ADD COLUMN "observacao" TEXT NOT NULL DEFAULT '';
