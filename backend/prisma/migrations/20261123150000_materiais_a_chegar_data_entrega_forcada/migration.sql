-- CreateTable
CREATE TABLE "materiais_a_chegar_data_entrega_forcada" (
    "id" SERIAL NOT NULL,
    "idPedidoCompra" INTEGER NOT NULL,
    "pedido" TEXT NOT NULL,
    "fornecedor" TEXT,
    "menorDataEntrega" TEXT,
    "menorDias" INTEGER,
    "usuarioLogin" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiais_a_chegar_data_entrega_forcada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "materiais_a_chegar_data_entrega_forcada_idPedidoCompra_idx" ON "materiais_a_chegar_data_entrega_forcada"("idPedidoCompra");

-- CreateIndex
CREATE INDEX "materiais_a_chegar_data_entrega_forcada_pedido_idx" ON "materiais_a_chegar_data_entrega_forcada"("pedido");

-- CreateIndex
CREATE INDEX "materiais_a_chegar_data_entrega_forcada_criadoEm_idx" ON "materiais_a_chegar_data_entrega_forcada"("criadoEm");
