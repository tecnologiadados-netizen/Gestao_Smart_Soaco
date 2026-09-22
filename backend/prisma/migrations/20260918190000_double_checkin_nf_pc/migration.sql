-- Double CheckIn: justificativas e decisões do comparativo NF × Pedido de compra.
CREATE TABLE "double_checkin_justificativa_opcao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_justificativa_opcao_codigo_key"
  ON "double_checkin_justificativa_opcao"("codigo");

CREATE TABLE "double_checkin_comparativo_decisao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "idItemDocumentoEstoque" INTEGER NOT NULL,
    "idItemPedidoCompra" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "justificativaOpcaoId" INTEGER NOT NULL,
    "observacao" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "double_checkin_comparativo_decisao_justificativaOpcaoId_fkey"
      FOREIGN KEY ("justificativaOpcaoId") REFERENCES "double_checkin_justificativa_opcao" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "double_checkin_comparativo_decisao_doc_item_pc_campo_key"
  ON "double_checkin_comparativo_decisao"(
    "idDocumentoEstoque",
    "idItemDocumentoEstoque",
    "idItemPedidoCompra",
    "campo"
  );

CREATE INDEX "double_checkin_comparativo_decisao_idDocumentoEstoque_idx"
  ON "double_checkin_comparativo_decisao"("idDocumentoEstoque");
