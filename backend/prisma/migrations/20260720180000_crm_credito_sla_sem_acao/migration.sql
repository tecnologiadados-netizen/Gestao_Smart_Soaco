-- AlterTable: prazo SLA sem ação + e-mail ao gestor
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "email_sla_enviado_em" DATETIME;

ALTER TABLE "crm_credito_pendencia_email_config" ADD COLUMN "prazo_horas_sem_acao" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "crm_credito_pendencia_email_config" ADD COLUMN "alerta_prazo_ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "crm_credito_pendencia_email_config" ADD COLUMN "destinatarios_gestor_to" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "crm_credito_pendencia_email_config" ADD COLUMN "destinatarios_gestor_cc" TEXT NOT NULL DEFAULT '[]';
