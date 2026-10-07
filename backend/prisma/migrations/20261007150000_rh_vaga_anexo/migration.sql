-- PDF do post da vaga. Vagas já existentes ficam sem anexo.
ALTER TABLE "rh_vaga" ADD COLUMN "anexo_nome" TEXT;
ALTER TABLE "rh_vaga" ADD COLUMN "anexo_path" TEXT;
