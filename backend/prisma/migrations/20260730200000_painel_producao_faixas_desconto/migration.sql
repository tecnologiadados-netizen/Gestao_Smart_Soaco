-- CreateTable
CREATE TABLE "painel_producao_faixa_desconto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mes_ano" TEXT NOT NULL,
    "media_min" REAL NOT NULL,
    "media_max" REAL,
    "percentual_desconto" REAL NOT NULL,
    "ordem" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "painel_producao_faixa_desconto_mes_ano_ordem_key"
ON "painel_producao_faixa_desconto"("mes_ano", "ordem");

-- CreateIndex
CREATE INDEX "painel_producao_faixa_desconto_mes_ano_idx"
ON "painel_producao_faixa_desconto"("mes_ano");

-- Seed das faixas atuais para todos os meses já cadastrados.
INSERT INTO "painel_producao_faixa_desconto"
    ("mes_ano", "media_min", "media_max", "percentual_desconto", "ordem")
SELECT m."mes_ano", f."media_min", f."media_max", f."percentual_desconto", f."ordem"
FROM "painel_producao_mes" m
CROSS JOIN (
    SELECT 0.00 AS "media_min", 1.99 AS "media_max", 0.00 AS "percentual_desconto", 1 AS "ordem"
    UNION ALL SELECT 2.00, 3.99, 20.00, 2
    UNION ALL SELECT 4.00, 5.00, 30.00, 3
    UNION ALL SELECT 5.01, NULL, 40.00, 4
) f;
