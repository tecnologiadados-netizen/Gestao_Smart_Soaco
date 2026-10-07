-- Cor do post-it. Vagas já existentes nascem brancas.
ALTER TABLE "rh_vaga" ADD COLUMN "cor" TEXT NOT NULL DEFAULT 'branco';
