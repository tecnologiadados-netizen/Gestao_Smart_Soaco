-- Apontamento local de título em cartório. Não altera Nomus nem Shop9.
CREATE TABLE IF NOT EXISTS "diario_cartorio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origem" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "usuario" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_cartorio_origem_codigo_key"
  ON "diario_cartorio"("origem", "codigo");
