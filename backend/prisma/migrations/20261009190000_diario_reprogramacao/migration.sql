-- Vencimento original da primeira reprogramação conhecida. Não altera Nomus nem Shop9.
CREATE TABLE IF NOT EXISTS "diario_reprogramacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origem" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "vencimento_original" TEXT,
    "texto" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_reprogramacao_origem_codigo_key"
  ON "diario_reprogramacao"("origem", "codigo");
