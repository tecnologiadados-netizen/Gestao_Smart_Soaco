-- Link do WhatsApp para registrar aprovação simples da coleta de preços.
CREATE TABLE IF NOT EXISTS "coleta_precos_aprovacao_link" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coletaPrecosId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "enviadoPorLogin" TEXT NOT NULL,
    "enviadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisao" TEXT,
    "decididoEm" DATETIME,
    "observacao" TEXT,
    "retratoJson" TEXT,
    "substituido" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "coleta_precos_aprovacao_link_coletaPrecosId_fkey"
      FOREIGN KEY ("coletaPrecosId") REFERENCES "coleta_precos" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coleta_precos_aprovacao_link_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "usuario" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "coleta_precos_aprovacao_link_token_key"
  ON "coleta_precos_aprovacao_link"("token");

CREATE INDEX IF NOT EXISTS "coleta_precos_aprovacao_link_coletaPrecosId_idx"
  ON "coleta_precos_aprovacao_link"("coletaPrecosId");

CREATE INDEX IF NOT EXISTS "coleta_precos_aprovacao_link_usuarioId_idx"
  ON "coleta_precos_aprovacao_link"("usuarioId");
