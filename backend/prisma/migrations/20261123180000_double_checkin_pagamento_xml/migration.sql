CREATE TABLE "double_checkin_pagamento_xml" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDocumentoEstoque" INTEGER NOT NULL,
    "chaveNfe" TEXT,
    "situacao" TEXT NOT NULL,
    "parcelasJson" TEXT NOT NULL DEFAULT '[]',
    "usuarioId" INTEGER NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "double_checkin_pagamento_xml_idDocumentoEstoque_key"
ON "double_checkin_pagamento_xml"("idDocumentoEstoque");
