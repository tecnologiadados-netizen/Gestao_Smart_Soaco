-- Base congelada do motor de materiais do Calendário de produção (BOM, saldo almox secundário e PC
-- pendente no momento do Gravar). Coluna separada de `payload` para o autosave do rascunho não
-- reescrever o JSON grande a cada PATCH. Snapshots antigos ficam NULL e caem no modo ao vivo.
ALTER TABLE "sequenciamento_carradas_snapshot" ADD COLUMN "baseMateriais" TEXT;

-- Consultas ao Nomus congeladas sob demanda (primeira abertura persiste o resultado).
CREATE TABLE "sequenciamento_snapshot_consulta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "capturadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sequenciamento_snapshot_consulta_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "sequenciamento_carradas_snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sequenciamento_snapshot_consulta_snapshotId_idx" ON "sequenciamento_snapshot_consulta"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "sequenciamento_snapshot_consulta_snapshotId_tipo_chave_key" ON "sequenciamento_snapshot_consulta"("snapshotId", "tipo", "chave");
