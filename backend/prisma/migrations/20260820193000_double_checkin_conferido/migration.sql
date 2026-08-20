-- Double CheckIn: conferência manual da NF (senha do usuário).
CREATE TABLE "double_checkin_conferido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "conferidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL
);

CREATE UNIQUE INDEX "double_checkin_conferido_idDocumentoEstoque_key"
  ON "double_checkin_conferido"("idDocumentoEstoque");

CREATE INDEX "double_checkin_conferido_usuarioId_idx"
  ON "double_checkin_conferido"("usuarioId");
