-- Catálogo base da ordem de produção, copiado dos produtos pai do sistema de exemplo.
-- Sem filhos: o vínculo com o NOMUS é feito depois, em Cadastros.
-- Inserção idempotente para não sobrescrever cadastro já ajustado em produção.

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'BALCÕES', 1
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'BALCÕES');

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'MOVEIS DE AÇO', 2
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'MOVEIS DE AÇO');

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'RESFRIADORES', 3
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'RESFRIADORES');

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'FOGÕES', 4
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'FOGÕES');

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'MOVEIS MELAMINICO', 5
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'MOVEIS MELAMINICO');

INSERT INTO "decomposicao_setor" ("nome", "sortOrder")
SELECT 'CADEIRAS', 6
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_setor" WHERE "nome" = 'CADEIRAS');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 0642', 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0642');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 0643', 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0643');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 0644', 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0644');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 12297', 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12297');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 12377', 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12377');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 12416', 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12416');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 12417', 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12417');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 12446', 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12446');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 2428', 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 2428');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 2434', 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 2434');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 8771', 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 8771');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 9213', 'BALCÃO CAIXA MELAMINICO STANDER 700 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9213');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 9217', 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9217');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PA 9225', 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9225');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PRD-2612', 'BALCÃO TENDAL 2000MM - SLIM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-2612');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PRD-3468', 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-3468');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PRD-4116', 'BALCÃO TENDAL 1500', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-4116');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PRD-6318', 'BALCÃO AR-FORÇADO 4 PORTAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6318');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'BALCÕES', 'PRD-6517', 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6517');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PA 12214', 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO CONCHA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12214');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PA 12214-2', 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO', 'Código repetido no sistema de exemplo: PA 12214.', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12214-2');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PRD-1229', 'PÉ PARA CADEIRA CAIXA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-1229');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PRD-4406', 'CADEIRA FIXA ESTOFADA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-4406');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PRD-6486', 'PESCOÇO PARA CADEIRA FIXA, SECRETARIA, CAIXA E LONGARINA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6486');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'CADEIRAS', 'PRD-8541', 'CADEIRA FIXA ESTOFADA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-8541');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 0521', 'FORNO PARA PIZZA PRP 770 INOX', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0521');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 0523', 'FORNO PARA PIZZA PRP 900 INOX', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0523');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 0663', 'FORNO PARA PIZZA PRP 1300 INOX', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 0663');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 11130', 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11130');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 11148', 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11148');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 11150', 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11150');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 3760', 'CHAPA BIFETEIRA 1600X570MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 3760');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9095', 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9095');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9916', 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9916');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9917', 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9917');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9926', 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9926');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9927', 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9927');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PA 9929', 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 9929');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-1722', 'MEDIDAS QUEIMADOR 770', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-1722');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-1750', 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-1750');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-2045', 'FOGÃO COM 6 BOCAS SIMPLES', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-2045');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-4200', 'FOGÃO COM 1 BOCA SIMPLES', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-4200');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-5044', 'FOGÃO DE 06 BOCAS DUPLAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5044');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-5348', 'FORNO GRANDE PARA FOGÃO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5348');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-5558', 'FOGÃO 08 BOCAS SIMPLES', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5558');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-5634', 'MEDIDAS QUEIMADOR 1300', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5634');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-5713', 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5713');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-6529', 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6529');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-6898', 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6898');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-8834', 'FOGÃO DE 08 BOCAS DUPLAS', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-8834');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-8876', 'FORNO PEQUENO PARA FOGÃO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-8876');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'FOGÕES', 'PRD-9790', 'MEDIDAS QUEIMADOR 900', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-9790');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 10510', 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 10510');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 10557', 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 10557');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 11193', 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11193');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 11330', 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11330');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 11388', 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 11388');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 12144', 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12144');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 12197', 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12197');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 12259', 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12259');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 12310', 'ESTANTE 2500X1200X500MM COLUNA CH 16 BANDEJA CH18', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 12310');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 2935', 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 2935');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PA 8284', 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PA 8284');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-2158', 'CAIXA LEITURA ÓPTICA', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-2158');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-3328', 'PORTA P/ ARMÁRIO VITRINE', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-3328');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-5207', 'GAVETEITO CHECKOUT', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-5207');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-6151', 'MEDIDA PARA CAIXA FECHADO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6151');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-6538', 'MESA P/PIZZA 1500X700X900 MM', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-6538');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS DE AÇO', 'PRD-8532', 'ARMÁRIO ANÃO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-8532');

INSERT INTO "decomposicao_produto_pai" ("grupo", "codigo", "nome", "observacao", "criadoPorLogin", "createdAt", "updatedAt")
SELECT 'MOVEIS MELAMINICO', 'PRD-3693', 'MESA MELAMINICO', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "decomposicao_produto_pai" WHERE "codigo" = 'PRD-3693');
