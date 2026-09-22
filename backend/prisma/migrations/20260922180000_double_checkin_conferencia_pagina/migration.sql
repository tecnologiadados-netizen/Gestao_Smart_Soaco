-- Página pública da conferência NF × PC (link permanente no WhatsApp).
CREATE TABLE "double_checkin_conferencia_pagina" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_conferencia_pagina_token_key"
  ON "double_checkin_conferencia_pagina"("token");

CREATE UNIQUE INDEX "double_checkin_conferencia_pagina_idDocumentoEstoque_key"
  ON "double_checkin_conferencia_pagina"("idDocumentoEstoque");
