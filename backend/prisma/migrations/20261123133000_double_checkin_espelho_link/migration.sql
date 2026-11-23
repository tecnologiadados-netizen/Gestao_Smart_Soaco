CREATE TABLE "double_checkin_espelho_link" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "cabecalhoJson" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_espelho_link_token_key"
ON "double_checkin_espelho_link"("token");

CREATE UNIQUE INDEX "double_checkin_espelho_link_idDocumentoEstoque_key"
ON "double_checkin_espelho_link"("idDocumentoEstoque");
