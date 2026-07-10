-- Fluxo de status do sequenciamento de carradas: 'rascunho' -> 'concluido'.
-- Snapshots antigos (gravados antes do fluxo) ficam como 'concluido' (somente leitura).
ALTER TABLE "sequenciamento_carradas_snapshot" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'concluido';
-- SQLite não permite DEFAULT CURRENT_TIMESTAMP em ADD COLUMN; preenche com createdAt.
ALTER TABLE "sequenciamento_carradas_snapshot" ADD COLUMN "updatedAt" DATETIME;
UPDATE "sequenciamento_carradas_snapshot" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
