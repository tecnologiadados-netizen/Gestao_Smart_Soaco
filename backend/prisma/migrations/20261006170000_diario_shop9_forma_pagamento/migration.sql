-- Vínculo local da forma de pagamento do Diário Financeiro (Shop9). Não altera o Shop9.
CREATE TABLE IF NOT EXISTS "diario_shop9_forma_pagamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordem_financeira" INTEGER NOT NULL,
    "codigo_forma" TEXT NOT NULL,
    "nome_forma" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_shop9_forma_pagamento_ordem_financeira_key"
  ON "diario_shop9_forma_pagamento"("ordem_financeira");
