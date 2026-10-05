ALTER TABLE "double_checkin_conferido"
ADD COLUMN "temDivergenciaRealHistorica" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "double_checkin_conferido"
ADD COLUMN "totalDivergenciasReaisHistorica" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "double_checkin_conferido"
ADD COLUMN "totalDivergenciasBenignasHist" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "double_checkin_conferido"
ADD COLUMN "naturezaClassificacaoFonte" TEXT;

ALTER TABLE "double_checkin_conferido"
ADD COLUMN "naturezaClassificadaEm" DATETIME;
