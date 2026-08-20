-- CreateTable
CREATE TABLE "crm_inadimplente_tarefa_recebimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tarefa_id" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "criado_por_login" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_inadimplente_tarefa_recebimento_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "crm_inadimplente_tarefa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "crm_inadimplente_tarefa_recebimento_tarefa_id_data_idx" ON "crm_inadimplente_tarefa_recebimento"("tarefa_id", "data");
