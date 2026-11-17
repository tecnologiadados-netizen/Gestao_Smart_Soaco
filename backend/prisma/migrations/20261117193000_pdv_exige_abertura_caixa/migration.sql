-- PDV: empresa pode exigir abertura de caixa ou operar só como força de vendas.
ALTER TABLE "pdv_empresa_config" ADD COLUMN "exige_abertura_caixa" BOOLEAN NOT NULL DEFAULT 1;
