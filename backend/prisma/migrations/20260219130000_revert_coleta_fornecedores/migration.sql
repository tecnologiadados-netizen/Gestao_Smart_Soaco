-- Revert: remove column fornecedores from coleta_precos (SQLite 3.35+)
ALTER TABLE "coleta_precos" DROP COLUMN "fornecedores";
