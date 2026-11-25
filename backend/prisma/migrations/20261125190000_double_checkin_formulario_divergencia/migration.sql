-- Formulário de divergência anexado no aceite. Opcional.
CREATE TABLE "double_checkin_formulario_divergencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "idItemDocumentoEstoque" INTEGER NOT NULL,
    "idItemPedidoCompra" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "dci_formulario_divergencia_chave"
ON "double_checkin_formulario_divergencia"("idDocumentoEstoque", "idItemDocumentoEstoque", "idItemPedidoCompra", "campo");

CREATE INDEX "dci_formulario_divergencia_doc_idx"
ON "double_checkin_formulario_divergencia"("idDocumentoEstoque");
