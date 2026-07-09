-- CreateTable
CREATE TABLE "pendencias_compras_prioridade_fixa" (
    "usuario" TEXT NOT NULL,
    "comprador" TEXT NOT NULL,
    "id_produto" INTEGER NOT NULL,
    "prioridade" INTEGER NOT NULL,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("usuario", "comprador", "id_produto")
);

-- CreateIndex
CREATE INDEX "pendencias_compras_prioridade_fixa_usuario_comprador_idx" ON "pendencias_compras_prioridade_fixa"("usuario", "comprador");
