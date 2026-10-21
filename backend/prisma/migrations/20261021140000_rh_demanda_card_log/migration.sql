-- Histórico de alterações de cada card das demandas internas.
CREATE TABLE IF NOT EXISTS "rh_demanda_card_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "card_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_demanda_card_log_card_id_fkey"
      FOREIGN KEY ("card_id") REFERENCES "rh_demanda_card" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "rh_demanda_card_log_card_id_created_at_idx"
  ON "rh_demanda_card_log"("card_id", "created_at");

-- Cards que já existiam ganham o registro de criação (o resto do histórico não foi guardado).
INSERT INTO "rh_demanda_card_log" ("id", "card_id", "descricao", "autor", "created_at")
SELECT lower(hex(randomblob(16))), "id", 'Card criado.', COALESCE("created_by", 'sistema'), "created_at"
FROM "rh_demanda_card"
WHERE NOT EXISTS (SELECT 1 FROM "rh_demanda_card_log" WHERE "card_id" = "rh_demanda_card"."id");
