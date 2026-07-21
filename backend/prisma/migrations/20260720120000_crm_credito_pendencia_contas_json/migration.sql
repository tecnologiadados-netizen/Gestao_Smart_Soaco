-- Snapshot das contas em atraso (código/vencimento) para grade rápida sem N+1 no Nomus
ALTER TABLE "crm_credito_pendencia" ADD COLUMN "contas_atraso_json" TEXT;
