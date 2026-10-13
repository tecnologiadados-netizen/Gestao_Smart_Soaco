-- Processo do contas a pagar do Diário Financeiro. Um por dia de vencimento.
CREATE TABLE IF NOT EXISTS "diario_contas_pagar_processo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" INTEGER NOT NULL,
    "data_vencimento" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "motivo_devolucao" TEXT,
    "aprovado_por" TEXT,
    "aprovado_em" DATETIME,
    "enviado_em" DATETIME,
    "atualizado_em" DATETIME NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "diario_contas_pagar_processo_codigo_key"
  ON "diario_contas_pagar_processo"("codigo");

CREATE UNIQUE INDEX IF NOT EXISTS "diario_contas_pagar_processo_data_vencimento_key"
  ON "diario_contas_pagar_processo"("data_vencimento");
