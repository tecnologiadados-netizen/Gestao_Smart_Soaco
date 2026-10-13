-- Ordens emitidas a partir do produto pai, com o detalhe gravado para o PDF.
CREATE TABLE IF NOT EXISTS "decomposicao_ordem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "paiId" INTEGER,
    "grupo" TEXT NOT NULL,
    "codigoPai" TEXT NOT NULL,
    "nomePai" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "observacao" TEXT,
    "criadoPorLogin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decomposicao_ordem_paiId_fkey"
      FOREIGN KEY ("paiId") REFERENCES "decomposicao_produto_pai" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "decomposicao_ordem_numero_key" ON "decomposicao_ordem"("numero");
CREATE INDEX IF NOT EXISTS "decomposicao_ordem_grupo_idx" ON "decomposicao_ordem"("grupo");
CREATE INDEX IF NOT EXISTS "decomposicao_ordem_paiId_idx" ON "decomposicao_ordem"("paiId");

CREATE TABLE IF NOT EXISTS "decomposicao_ordem_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordemId" INTEGER NOT NULL,
    "codigoNomus" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadeNoPai" INTEGER NOT NULL,
    "quantidadeTotal" REAL NOT NULL,
    "materiaPrimaCodigo" TEXT,
    "materiaPrimaDescricao" TEXT,
    "qtdePedida" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "decomposicao_ordem_item_ordemId_fkey"
      FOREIGN KEY ("ordemId") REFERENCES "decomposicao_ordem" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "decomposicao_ordem_item_ordemId_idx" ON "decomposicao_ordem_item"("ordemId");
