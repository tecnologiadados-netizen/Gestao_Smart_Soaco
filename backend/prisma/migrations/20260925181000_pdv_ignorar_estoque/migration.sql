-- Permite, por empresa, vender no PDV sem bloquear pelo saldo. Padrão desligado.
ALTER TABLE "pdv_empresa_config" ADD COLUMN "ignorar_estoque" BOOLEAN NOT NULL DEFAULT false;
