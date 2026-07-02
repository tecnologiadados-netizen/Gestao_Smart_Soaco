-- CreateTable
CREATE TABLE "mind_map_saved" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapDescription" TEXT,
    "graphJson" TEXT NOT NULL,
    "criadoPorLogin" TEXT NOT NULL,
    "criadoPorNome" TEXT,
    "atualizadoPorLogin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "mind_map_saved_uid_key" ON "mind_map_saved"("uid");

-- CreateIndex
CREATE INDEX "mind_map_saved_criadoPorLogin_idx" ON "mind_map_saved"("criadoPorLogin");

-- CreateIndex
CREATE INDEX "mind_map_saved_updatedAt_idx" ON "mind_map_saved"("updatedAt");
