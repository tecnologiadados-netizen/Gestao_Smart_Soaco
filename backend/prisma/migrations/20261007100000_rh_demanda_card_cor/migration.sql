-- Cor do post-it. Cards já existentes nascem brancos.
ALTER TABLE "rh_demanda_card" ADD COLUMN "cor" TEXT NOT NULL DEFAULT 'branco';
