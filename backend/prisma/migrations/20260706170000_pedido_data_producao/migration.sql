-- CreateTable
CREATE TABLE "pedido_data_producao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_pedido" TEXT NOT NULL,
    "data_producao" DATETIME NOT NULL,
    "usuario" TEXT NOT NULL,
    "data_registro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "pedido_data_producao_id_pedido_idx" ON "pedido_data_producao"("id_pedido");

-- CreateIndex
CREATE INDEX "pedido_data_producao_data_registro_idx" ON "pedido_data_producao"("data_registro");
