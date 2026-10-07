CREATE TABLE IF NOT EXISTS "rh_vaga" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "prazo" TEXT,
    "observacao" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "rh_vaga_status_idx" ON "rh_vaga"("status");
CREATE INDEX IF NOT EXISTS "rh_vaga_created_at_idx" ON "rh_vaga"("created_at");

CREATE TABLE IF NOT EXISTS "rh_vaga_historico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vaga_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "prazo" TEXT,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_vaga_historico_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "rh_vaga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rh_vaga_historico_vaga_id_created_at_idx" ON "rh_vaga_historico"("vaga_id", "created_at");
