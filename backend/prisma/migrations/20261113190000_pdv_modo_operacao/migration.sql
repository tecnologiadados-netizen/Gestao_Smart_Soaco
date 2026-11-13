-- PDV: modo de operação por empresa e vínculo de proposta no Nomus.
ALTER TABLE "pdv_empresa_config" ADD COLUMN "modo_operacao" TEXT NOT NULL DEFAULT 'pedido';
ALTER TABLE "pdv_venda" ADD COLUMN "destino_nomus" TEXT NOT NULL DEFAULT 'pedido';
ALTER TABLE "pdv_venda" ADD COLUMN "id_proposta_nomus" INTEGER;
