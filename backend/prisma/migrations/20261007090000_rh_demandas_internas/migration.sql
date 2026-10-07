-- Quadros, listas, cards e prints das demandas internas (RH e diretoria).
CREATE TABLE IF NOT EXISTS "rh_demanda_quadro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "rh_demanda_lista" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quadro_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "rh_demanda_lista_quadro_id_fkey"
      FOREIGN KEY ("quadro_id") REFERENCES "rh_demanda_quadro" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rh_demanda_lista_quadro_id_ordem_idx"
  ON "rh_demanda_lista"("quadro_id", "ordem");

CREATE TABLE IF NOT EXISTS "rh_demanda_card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quadro_id" TEXT NOT NULL,
    "lista_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "checklists" TEXT NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rh_demanda_card_lista_id_fkey"
      FOREIGN KEY ("lista_id") REFERENCES "rh_demanda_lista" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rh_demanda_card_lista_id_ordem_idx"
  ON "rh_demanda_card"("lista_id", "ordem");

CREATE INDEX IF NOT EXISTS "rh_demanda_card_quadro_id_idx"
  ON "rh_demanda_card"("quadro_id");

CREATE TABLE IF NOT EXISTS "rh_demanda_anexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "card_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_demanda_anexo_card_id_fkey"
      FOREIGN KEY ("card_id") REFERENCES "rh_demanda_card" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rh_demanda_anexo_card_id_idx"
  ON "rh_demanda_anexo"("card_id");
