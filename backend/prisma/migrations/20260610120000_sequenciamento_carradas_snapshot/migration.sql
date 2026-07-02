-- CreateTable
CREATE TABLE "sequenciamento_carradas_snapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cod" TEXT NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "carradaCount" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "sequenciamento_carradas_snapshot_cod_key" ON "sequenciamento_carradas_snapshot"("cod");

-- CreateIndex
CREATE INDEX "sequenciamento_carradas_snapshot_createdAt_idx" ON "sequenciamento_carradas_snapshot"("createdAt");
