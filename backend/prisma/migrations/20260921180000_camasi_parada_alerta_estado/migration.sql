-- Estado anti-spam do alerta WhatsApp de parada Camasi (um envio por episódio).
CREATE TABLE "camasi_parada_alerta_estado" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "data" TEXT NOT NULL,
    "inicio_enviado" BOOLEAN NOT NULL DEFAULT false,
    "ultima_producao_fim" TEXT,
    "pos_producao_enviado" BOOLEAN NOT NULL DEFAULT false,
    "last_sent_at" DATETIME,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
