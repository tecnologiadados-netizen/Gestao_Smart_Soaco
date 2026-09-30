-- Vínculo local da conta bancária do Diário Financeiro (Shop9). Não altera o Shop9.
CREATE TABLE IF NOT EXISTS "diario_shop9_conta_bancaria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordem_financeira" INTEGER NOT NULL,
    "ordem_conta_bancaria" INTEGER NOT NULL,
    "nome_conta" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_shop9_conta_bancaria_ordem_financeira_key"
  ON "diario_shop9_conta_bancaria"("ordem_financeira");
