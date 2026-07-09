-- Prioridade fixa: consolidar por comprador + produto (mantém registro mais recente por atualizado_em)
CREATE TABLE "pendencias_compras_prioridade_fixa_new" (
    "comprador" TEXT NOT NULL,
    "id_produto" INTEGER NOT NULL,
    "prioridade" INTEGER NOT NULL,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("comprador", "id_produto")
);

INSERT INTO "pendencias_compras_prioridade_fixa_new" ("comprador", "id_produto", "prioridade", "atualizado_em")
SELECT "comprador", "id_produto", "prioridade", "atualizado_em"
FROM (
    SELECT
        "comprador",
        "id_produto",
        "prioridade",
        "atualizado_em",
        ROW_NUMBER() OVER (
            PARTITION BY "comprador", "id_produto"
            ORDER BY "atualizado_em" DESC
        ) AS rn
    FROM "pendencias_compras_prioridade_fixa"
) ranked
WHERE rn = 1;

DROP TABLE "pendencias_compras_prioridade_fixa";
ALTER TABLE "pendencias_compras_prioridade_fixa_new" RENAME TO "pendencias_compras_prioridade_fixa";

CREATE INDEX "pendencias_compras_prioridade_fixa_comprador_idx"
ON "pendencias_compras_prioridade_fixa"("comprador");

-- Histórico de alterações
CREATE TABLE "pendencias_compras_prioridade_fixa_historico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comprador" TEXT NOT NULL,
    "id_produto" INTEGER NOT NULL,
    "prioridade_anterior" INTEGER,
    "prioridade_nova" INTEGER,
    "usuario_login" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "pendencias_compras_prioridade_fixa_historico_comprador_id_produto_idx"
ON "pendencias_compras_prioridade_fixa_historico"("comprador", "id_produto");
