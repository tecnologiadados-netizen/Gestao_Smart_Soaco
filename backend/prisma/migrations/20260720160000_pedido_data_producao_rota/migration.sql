-- Adiciona coluna `rota` em pedido_data_producao para suporte a override por rota
-- (quando o mesmo (PD, item) está vinculado a 2+ romaneios com datas de produção diferentes).
--   rota = NULL  => ajuste base (vale em todas as rotas do PD/item).
--   rota != NULL => override por rota (nome da observação do romaneio, já normalizado).
ALTER TABLE "pedido_data_producao" ADD COLUMN "rota" TEXT;

CREATE INDEX "pedido_data_producao_id_pedido_rota_idx" ON "pedido_data_producao"("id_pedido", "rota");
