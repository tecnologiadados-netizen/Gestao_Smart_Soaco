CREATE TABLE "double_checkin_divergencia_apontada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "idItemDocumentoEstoque" INTEGER NOT NULL,
    "idItemPedidoCompra" INTEGER NOT NULL,
    "idPedidoCompra" INTEGER NOT NULL,
    "nomePedidoCompra" TEXT NOT NULL,
    "nomeComprador" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "apontadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_divergencia_apontada_idDocumentoEstoque_idItemDocumentoEstoque_idItemPedidoCompra_campo_key"
ON "double_checkin_divergencia_apontada"("idDocumentoEstoque", "idItemDocumentoEstoque", "idItemPedidoCompra", "campo");

CREATE INDEX "double_checkin_divergencia_apontada_idDocumentoEstoque_idx"
ON "double_checkin_divergencia_apontada"("idDocumentoEstoque");
