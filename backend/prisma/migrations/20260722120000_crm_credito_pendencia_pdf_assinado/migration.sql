-- AlterTable
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "pdf_assinado_nome" TEXT;
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "pdf_assinado_storage_path" TEXT;
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "pdf_assinado_mime_type" TEXT;
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "pdf_assinado_em" DATETIME;
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "pdf_assinado_por_login" TEXT;
