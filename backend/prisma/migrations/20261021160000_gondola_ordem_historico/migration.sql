CREATE TABLE "gondola_ordem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criado_por_login" TEXT,
    "snapshot" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

CREATE UNIQUE INDEX "gondola_ordem_numero_key" ON "gondola_ordem"("numero");

CREATE TABLE "gondola_ordem_peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordem_id" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "pedido" TEXT NOT NULL DEFAULT '',
    "chave_peca" TEXT NOT NULL,
    CONSTRAINT "gondola_ordem_peca_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "gondola_ordem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "gondola_ordem_peca_id_item_chave_peca_key" ON "gondola_ordem_peca"("id_item", "chave_peca");
CREATE INDEX "gondola_ordem_peca_ordem_id_idx" ON "gondola_ordem_peca"("ordem_id");

CREATE TABLE "gondola_item_concluido" (
    "id_item" INTEGER NOT NULL PRIMARY KEY,
    "ordem_id" INTEGER NOT NULL,
    "concluido_em" TEXT NOT NULL
);
