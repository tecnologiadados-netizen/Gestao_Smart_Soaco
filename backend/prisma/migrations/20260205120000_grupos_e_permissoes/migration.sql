-- CreateTable grupo_usuario
CREATE TABLE "grupo_usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "permissoes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "grupo_usuario_nome_key" ON "grupo_usuario"("nome");

-- AddColumn grupoId to usuario (SQLite: add column then we don't enforce FK in migration)
ALTER TABLE "usuario" ADD COLUMN "grupoId" INTEGER;

CREATE INDEX "usuario_grupoId_idx" ON "usuario"("grupoId");
