CREATE TABLE "double_checkin_espelho_primeira_leitura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "linhasJson" TEXT NOT NULL,
    "gravadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_espelho_primeira_leitura_idDocumentoEstoque_key"
ON "double_checkin_espelho_primeira_leitura"("idDocumentoEstoque");
