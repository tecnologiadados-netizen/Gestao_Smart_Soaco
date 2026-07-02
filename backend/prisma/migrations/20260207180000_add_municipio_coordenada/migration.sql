-- CreateTable
CREATE TABLE "municipio_coordenada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome_normalizado" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "municipio_coordenada_nome_normalizado_uf_key" ON "municipio_coordenada"("nome_normalizado", "uf");

-- CreateIndex
CREATE INDEX "municipio_coordenada_nome_normalizado_uf_idx" ON "municipio_coordenada"("nome_normalizado", "uf");
