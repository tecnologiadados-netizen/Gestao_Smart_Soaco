-- Soluções cadastradas para cada causa do problema.
ALTER TABLE "sgq_causa_problema" ADD COLUMN "solucoesJson" TEXT NOT NULL DEFAULT '[]';
