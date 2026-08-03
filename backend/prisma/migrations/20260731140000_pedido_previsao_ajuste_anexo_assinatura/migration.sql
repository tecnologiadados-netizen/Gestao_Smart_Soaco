-- PDF de assinatura do responsável para justificativas não abonadas.
ALTER TABLE "pedido_previsao_ajuste" ADD COLUMN "anexo_assinatura_path" TEXT;
ALTER TABLE "pedido_previsao_ajuste" ADD COLUMN "anexo_assinatura_nome" TEXT;
ALTER TABLE "pedido_previsao_ajuste" ADD COLUMN "anexo_assinatura_grupo_id" TEXT;

CREATE INDEX "pedido_previsao_ajuste_anexo_assinatura_grupo_id_idx"
  ON "pedido_previsao_ajuste"("anexo_assinatura_grupo_id");
