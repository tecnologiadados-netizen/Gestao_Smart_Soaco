-- Agrupamento local de classificações do Diário Financeiro. Não altera Nomus nem Shop9.
CREATE TABLE IF NOT EXISTS "diario_subclassificacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "classificacao" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_subclassificacao_origem_codigo_key"
  ON "diario_subclassificacao"("origem", "codigo");
