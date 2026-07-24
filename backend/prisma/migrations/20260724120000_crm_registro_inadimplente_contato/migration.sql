-- CreateTable
CREATE TABLE "crm_registro_inadimplente_contato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "registro_id" INTEGER NOT NULL,
    "data_contato" DATETIME,
    "texto" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "criado_por_login" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_registro_inadimplente_contato_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "crm_registro_inadimplente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_contato_registro_id_data_contato_idx" ON "crm_registro_inadimplente_contato"("registro_id", "data_contato");

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_contato_registro_id_created_at_idx" ON "crm_registro_inadimplente_contato"("registro_id", "created_at");
