-- Migra veículo + carroceria em uma única tabela (dimensões na placa).

PRAGMA foreign_keys=OFF;

CREATE TABLE "cubagem_veiculo_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "alturaMm" INTEGER,
    "larguraMm" INTEGER,
    "profundidadeMm" INTEGER,
    "capacidadePesoKg" INTEGER,
    "taraKg" INTEGER,
    "pbtKg" INTEGER,
    "alturaEmpilhamentoMm" INTEGER,
    "aberturas" TEXT,
    "fatorAproveitamento" REAL NOT NULL DEFAULT 0.85,
    "ano" INTEGER,
    "motoristaPadrao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "cubagem_veiculo_new" (
    "id", "placa", "modelo",
    "alturaMm", "larguraMm", "profundidadeMm",
    "capacidadePesoKg", "taraKg", "pbtKg", "alturaEmpilhamentoMm", "aberturas", "fatorAproveitamento",
    "ano", "motoristaPadrao", "ativo", "createdAt", "updatedAt"
)
SELECT
    v."id",
    v."placa",
    v."modelo",
    t."alturaMm",
    t."larguraMm",
    t."profundidadeMm",
    t."capacidadePesoKg",
    t."taraKg",
    t."pbtKg",
    t."alturaEmpilhamentoMm",
    t."aberturas",
    COALESCE(t."fatorAproveitamento", 0.85),
    v."ano",
    v."motoristaPadrao",
    v."ativo",
    v."createdAt",
    v."updatedAt"
FROM "cubagem_veiculo" v
LEFT JOIN "cubagem_tipo_carroceria" t ON t."id" = v."tipoCarroceriaId";

DROP TABLE "cubagem_veiculo";
ALTER TABLE "cubagem_veiculo_new" RENAME TO "cubagem_veiculo";

CREATE UNIQUE INDEX "cubagem_veiculo_placa_key" ON "cubagem_veiculo"("placa");

DROP TABLE IF EXISTS "cubagem_tipo_carroceria";

PRAGMA foreign_keys=ON;
