CREATE TABLE "diario_contas_pagar_aprovacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "processo_id" INTEGER NOT NULL,
    "origem" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "banco" TEXT NOT NULL,
    "fornecedor" TEXT,
    "empresa" TEXT,
    "descricao" TEXT,
    "vencimento" TEXT,
    "saldo" REAL NOT NULL,
    "aprovado_por" TEXT NOT NULL,
    "aprovado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diario_contas_pagar_aprovacao_processo_id_fkey"
      FOREIGN KEY ("processo_id") REFERENCES "diario_contas_pagar_processo" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "diario_contas_pagar_aprovacao_processo_id_origem_codigo_key"
  ON "diario_contas_pagar_aprovacao"("processo_id", "origem", "codigo");

CREATE INDEX "diario_contas_pagar_aprovacao_processo_id_idx"
  ON "diario_contas_pagar_aprovacao"("processo_id");
