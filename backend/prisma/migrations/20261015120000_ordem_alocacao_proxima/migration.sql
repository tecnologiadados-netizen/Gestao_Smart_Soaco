-- Itens da carteira que entraram em cada ordem e a escolha de repetir na próxima.
CREATE TABLE IF NOT EXISTS "decomposicao_ordem_alocacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordemId" INTEGER NOT NULL,
    "idItem" INTEGER NOT NULL,
    "idPedido" INTEGER NOT NULL,
    "numeroPedido" TEXT NOT NULL DEFAULT '',
    "cliente" TEXT NOT NULL DEFAULT '',
    "codigoFilho" TEXT NOT NULL DEFAULT '',
    "descricaoFilho" TEXT NOT NULL DEFAULT '',
    "statusItem" INTEGER NOT NULL,
    "qtdePedida" REAL NOT NULL DEFAULT 0,
    "saldo" REAL NOT NULL DEFAULT 0,
    "apareceNaProxima" BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT "decomposicao_ordem_alocacao_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "decomposicao_ordem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "decomposicao_ordem_alocacao_ordemId_idItem_key" ON "decomposicao_ordem_alocacao"("ordemId", "idItem");
CREATE INDEX IF NOT EXISTS "decomposicao_ordem_alocacao_ordemId_idx" ON "decomposicao_ordem_alocacao"("ordemId");
CREATE INDEX IF NOT EXISTS "decomposicao_ordem_alocacao_idItem_idx" ON "decomposicao_ordem_alocacao"("idItem");
