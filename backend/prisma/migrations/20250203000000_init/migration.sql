-- CreateTable (SQLite - apenas dados do app; Nomus não é alterado)
CREATE TABLE "pedido_previsao_ajuste" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_pedido" TEXT NOT NULL,
    "previsao_nova" DATETIME NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "data_ajuste" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "pedido_previsao_ajuste_id_pedido_idx" ON "pedido_previsao_ajuste"("id_pedido");
CREATE INDEX "pedido_previsao_ajuste_data_ajuste_idx" ON "pedido_previsao_ajuste"("data_ajuste");

CREATE TABLE "usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "usuario_login_key" ON "usuario"("login");
