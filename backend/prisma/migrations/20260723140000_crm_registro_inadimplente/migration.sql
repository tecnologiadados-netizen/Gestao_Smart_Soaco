-- CreateTable
CREATE TABLE "crm_registro_inadimplente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vencimento" TEXT,
    "pagamento" TEXT,
    "empresa" TEXT,
    "banco" TEXT,
    "tipo" TEXT,
    "cliente" TEXT NOT NULL,
    "status" TEXT,
    "serasa" TEXT,
    "vendedor" TEXT,
    "total" REAL,
    "nf_pd" TEXT,
    "parcela" TEXT,
    "obs" TEXT,
    "origem_import" BOOLEAN NOT NULL DEFAULT false,
    "criado_por_login" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_cliente_idx" ON "crm_registro_inadimplente"("cliente");

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_empresa_idx" ON "crm_registro_inadimplente"("empresa");

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_status_idx" ON "crm_registro_inadimplente"("status");

-- CreateIndex
CREATE INDEX "crm_registro_inadimplente_vencimento_idx" ON "crm_registro_inadimplente"("vencimento");
