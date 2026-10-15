-- Número da solicitação no Otimiza, exigido antes de aceitar a divergência.
ALTER TABLE "double_checkin_comparativo_decisao" ADD COLUMN "numeroSolicitacaoOtimiza" INTEGER;

CREATE TABLE IF NOT EXISTS "double_checkin_solicitacao_otimiza" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "idItemDocumentoEstoque" INTEGER NOT NULL,
    "idItemPedidoCompra" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "double_checkin_solicitacao_otimiza_idDocumentoEstoque_idItemDocumentoEstoque_idItemPedidoCompra_campo_key"
ON "double_checkin_solicitacao_otimiza"("idDocumentoEstoque", "idItemDocumentoEstoque", "idItemPedidoCompra", "campo");

CREATE INDEX IF NOT EXISTS "double_checkin_solicitacao_otimiza_idDocumentoEstoque_idx"
ON "double_checkin_solicitacao_otimiza"("idDocumentoEstoque");
