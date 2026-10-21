-- Prioridade (baixa | media | alta) e responsáveis do orgânico (JSON: [{ matricula, nome }]).
ALTER TABLE "rh_demanda_card" ADD COLUMN "prioridade" TEXT;
ALTER TABLE "rh_demanda_card" ADD COLUMN "responsaveis" TEXT NOT NULL DEFAULT '[]';
