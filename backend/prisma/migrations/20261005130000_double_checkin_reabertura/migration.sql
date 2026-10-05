ALTER TABLE "double_checkin_conferido"
  ADD COLUMN "reabertoEm" DATETIME;

ALTER TABLE "double_checkin_conferido"
  ADD COLUMN "reabertoPorUsuarioId" INTEGER;

ALTER TABLE "double_checkin_conferido"
  ADD COLUMN "reabertoPorLogin" TEXT;
