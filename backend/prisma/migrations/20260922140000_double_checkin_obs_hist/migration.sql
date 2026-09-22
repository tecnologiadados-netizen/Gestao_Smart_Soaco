-- Histórico acumulativo de observações por divergência NF × PC.
CREATE TABLE "double_checkin_comparativo_obs_hist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "idItemDocumentoEstoque" INTEGER NOT NULL,
    "idItemPedidoCompra" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "double_checkin_comparativo_obs_hist_chave_idx"
  ON "double_checkin_comparativo_obs_hist"(
    "idDocumentoEstoque",
    "idItemDocumentoEstoque",
    "idItemPedidoCompra",
    "campo"
  );

CREATE INDEX "double_checkin_comparativo_obs_hist_idDocumentoEstoque_idx"
  ON "double_checkin_comparativo_obs_hist"("idDocumentoEstoque");

-- Migra observações já gravadas na decisão como primeiro registro do histórico.
INSERT INTO "double_checkin_comparativo_obs_hist" (
  "idDocumentoEstoque",
  "idItemDocumentoEstoque",
  "idItemPedidoCompra",
  "campo",
  "texto",
  "usuarioId",
  "usuarioLogin",
  "criadoEm"
)
SELECT
  d."idDocumentoEstoque",
  d."idItemDocumentoEstoque",
  d."idItemPedidoCompra",
  d."campo",
  TRIM(d."observacao"),
  d."usuarioId",
  d."usuarioLogin",
  d."atualizadoEm"
FROM "double_checkin_comparativo_decisao" d
WHERE d."observacao" IS NOT NULL
  AND TRIM(d."observacao") <> '';
