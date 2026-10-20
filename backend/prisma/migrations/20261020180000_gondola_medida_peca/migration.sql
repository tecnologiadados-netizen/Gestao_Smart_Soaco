CREATE TABLE "gondola_medida_peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "medida01" TEXT NOT NULL DEFAULT '',
    "medida02" TEXT NOT NULL DEFAULT '',
    "atualizado_em" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "gondola_medida_peca_codigo_key" ON "gondola_medida_peca"("codigo");
