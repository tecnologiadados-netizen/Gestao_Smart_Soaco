-- Inclui o setor "Checkout" (opção do atributo 679 "Setor de produção" no Nomus)
-- no cadastro de metas a partir de out/2026. Os meses seguintes herdam o setor
-- automaticamente ao serem abertos (registrarMesZerado).

INSERT OR IGNORE INTO "painel_producao_meta" ("setor", "mes_ano", "target", "sem_meta", "considerar_penalizacoes")
SELECT 'Checkout', "mes_ano", 0, false, true
FROM "painel_producao_mes"
WHERE "mes_ano" >= '2026-10-01';
