-- AlterTable
ALTER TABLE "crm_inadimplente_tarefa_contato" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'padrao';
ALTER TABLE "crm_inadimplente_tarefa_contato" ADD COLUMN "categoria" TEXT;
ALTER TABLE "crm_inadimplente_tarefa_contato" ADD COLUMN "justificativa" TEXT;
ALTER TABLE "crm_inadimplente_tarefa_contato" ADD COLUMN "meta_json" TEXT;

-- CreateIndex
CREATE INDEX "crm_inadimplente_tarefa_contato_tipo_idx" ON "crm_inadimplente_tarefa_contato"("tipo");
CREATE INDEX "crm_inadimplente_tarefa_contato_categoria_idx" ON "crm_inadimplente_tarefa_contato"("categoria");
