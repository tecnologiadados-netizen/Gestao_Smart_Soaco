-- CreateTable
CREATE TABLE "loja_kit_produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "estoque_inicial" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "loja_kit_inventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "observacao" TEXT,
    "usuario_id" INTEGER,
    "responsavel_nome" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "loja_kit_movimentacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produto_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "pd" TEXT,
    "usuario_id" INTEGER,
    "responsavel_nome" TEXT NOT NULL,
    "observacao" TEXT,
    "inventario_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loja_kit_movimentacao_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "loja_kit_produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "loja_kit_movimentacao_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "loja_kit_inventario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "loja_kit_inventario_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventario_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "qtd_sistema" INTEGER NOT NULL,
    "qtd_contada" INTEGER NOT NULL,
    CONSTRAINT "loja_kit_inventario_item_inventario_id_fkey" FOREIGN KEY ("inventario_id") REFERENCES "loja_kit_inventario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loja_kit_inventario_item_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "loja_kit_produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "loja_kit_produto_codigo_key" ON "loja_kit_produto"("codigo");

-- CreateIndex
CREATE INDEX "loja_kit_movimentacao_produto_id_created_at_idx" ON "loja_kit_movimentacao"("produto_id", "created_at");

-- CreateIndex
CREATE INDEX "loja_kit_movimentacao_tipo_created_at_idx" ON "loja_kit_movimentacao"("tipo", "created_at");

-- CreateIndex
CREATE INDEX "loja_kit_movimentacao_inventario_id_idx" ON "loja_kit_movimentacao"("inventario_id");

-- CreateIndex
CREATE UNIQUE INDEX "loja_kit_inventario_item_inventario_id_produto_id_key" ON "loja_kit_inventario_item"("inventario_id", "produto_id");

-- Seed produtos iniciais (Filtro e Engate)
INSERT INTO "loja_kit_produto" ("codigo", "descricao", "estoque_inicial", "ativo", "created_at", "updated_at")
VALUES
  ('PA0496', 'Filtro', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PC0001', 'Engate', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
