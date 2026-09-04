-- Categorias de tamanho (consumo km/L) + vínculo no veículo

CREATE TABLE "cubagem_tamanho_categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "consumoKmL" REAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "cubagem_tamanho_categoria_nome_key" ON "cubagem_tamanho_categoria"("nome");

INSERT INTO "cubagem_tamanho_categoria" ("nome", "consumoKmL", "ativo", "ordem", "updatedAt")
VALUES
  ('Pequeno', 5, true, 1, CURRENT_TIMESTAMP),
  ('Médio', 4.5, true, 2, CURRENT_TIMESTAMP),
  ('Grande Menor', 4, true, 3, CURRENT_TIMESTAMP),
  ('Grande Maior', 3, true, 4, CURRENT_TIMESTAMP);

ALTER TABLE "cubagem_veiculo" ADD COLUMN "tamanhoCategoriaId" INTEGER;

CREATE INDEX "cubagem_veiculo_tamanhoCategoriaId_idx" ON "cubagem_veiculo"("tamanhoCategoriaId");

UPDATE "cubagem_veiculo"
SET "tamanhoCategoriaId" = (SELECT "id" FROM "cubagem_tamanho_categoria" WHERE "nome" = 'Pequeno')
WHERE "placa" IN ('LVU1H85', 'LVU1H95', 'NIG7F97', 'OEA1H17', 'OUC6G70', 'OUC6G80');

UPDATE "cubagem_veiculo"
SET "tamanhoCategoriaId" = (SELECT "id" FROM "cubagem_tamanho_categoria" WHERE "nome" = 'Médio')
WHERE "placa" IN ('NHY8E04', 'PIX1F44', 'RSM1F99', 'RSQ9B26');

UPDATE "cubagem_veiculo"
SET "tamanhoCategoriaId" = (SELECT "id" FROM "cubagem_tamanho_categoria" WHERE "nome" = 'Grande Menor')
WHERE "placa" IN ('NIW6C51', 'PIW7H75');

UPDATE "cubagem_veiculo"
SET "tamanhoCategoriaId" = (SELECT "id" FROM "cubagem_tamanho_categoria" WHERE "nome" = 'Grande Maior')
WHERE "placa" IN ('NIB5502', 'NIW6D58', 'OEE4C36');
