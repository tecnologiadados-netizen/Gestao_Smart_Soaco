CREATE TABLE "double_checkin_espelho_leitura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "chaveItens" TEXT NOT NULL,
    "chaveVinculo" TEXT NOT NULL DEFAULT '',
    "linhasJson" TEXT NOT NULL,
    "gravadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_espelho_leitura_documento_ordem_key"
ON "double_checkin_espelho_leitura"("idDocumentoEstoque", "ordem");

CREATE TABLE "double_checkin_espelho_estado" (
    "idDocumentoEstoque" INTEGER NOT NULL PRIMARY KEY,
    "desvinculado" INTEGER NOT NULL DEFAULT 0
);
