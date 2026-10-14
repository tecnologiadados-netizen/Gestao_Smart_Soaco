-- Peças de corte dos produtos pai, copiadas do sistema de exemplo.
-- Só entra no pai que ainda não tem peça, para não apagar ajuste feito na tela.

CREATE TABLE IF NOT EXISTS "decomposicao_peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paiId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "medidaL" TEXT NOT NULL DEFAULT '',
    "medidaA" TEXT NOT NULL DEFAULT '',
    "materiaPrima" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "decomposicao_peca_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "decomposicao_produto_pai" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "decomposicao_peca_paiId_idx" ON "decomposicao_peca"("paiId");

CREATE TABLE IF NOT EXISTS "decomposicao_ordem_peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordemId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadeNoPai" INTEGER NOT NULL,
    "quantidadeTotal" REAL NOT NULL,
    "medidaL" TEXT NOT NULL DEFAULT '',
    "medidaA" TEXT NOT NULL DEFAULT '',
    "materiaPrima" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "decomposicao_ordem_peca_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "decomposicao_ordem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "decomposicao_ordem_peca_ordemId_idx" ON "decomposicao_ordem_peca"("ordemId");

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '2080', '860', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '1295', '400', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '1300', '60', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1300', '150', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '1340', '90', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '310', '750', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '2000', '860', 'CH 28 GALV', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '1300', '380', 'CH 28 GALV', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '880', '325', 'CH 28 GALV', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 2, '770', '160', 'CH 28 GALV', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 1, '1255', '40', 'CH 28 GALV', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '770', '60', 'CH 18 GALV', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 1, '860', '120', 'CH 18 GALV', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 1, '1205', '995', 'CH 22', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '825', '150', 'CH 22', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 2, '1290', '60', 'CH 16', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 2, '810', '60', 'CH 16', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 9, '750', '20', 'CH 14', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 5, '1180', '20', 'CH 14', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0663' AND pai."nome" = 'FORNO PARA PIZZA PRP 1300 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '110', '', 'TUBO 3/4 NA 0.75', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6151' AND pai."nome" = 'MEDIDA PARA CAIXA FECHADO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '25', '', 'TUBO 3/4 NA 0.75', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6151' AND pai."nome" = 'MEDIDA PARA CAIXA FECHADO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '3', '', 'TUBO 5/8 NA 0.75', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6151' AND pai."nome" = 'MEDIDA PARA CAIXA FECHADO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '2530', '140', 'CH 14', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '2550', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '1080', '140', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '1060', '140', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '2530', '120', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '2490', '90', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1020', '90', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 7, '100', '80', 'CH 20 OU 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 10, '1010', '40', 'CH 18', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 10, '390', '50', 'CH 18', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 20, '80', '25', 'CH 18', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 4, '100', '30', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 4, '960', '90', 'CH 18', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 4, '75', '75', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '50', '50', 'CH 18', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '150', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '150', 'CH 18', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '110', 'CH 18', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 5, '1040', '435', 'CH 28 PRETA', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1750' AND pai."nome" = 'FOGÃO INDUSTRIAL 10 BOCAS DUPLA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1610', '840', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '825', '400', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '830', '150', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '880', '110', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '830', '60', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '370', '90', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '310', '55', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '200', '40', 'CH 28 INOX', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '310', '750', 'CH 28 INOX', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '1530', '840', 'CH 28 GALV', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 1, '830', '380', 'CH 28 GALV', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '860', '325', 'CH 28 GALV', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '740', '150', 'CH 28 GALV', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 1, '830', '90', 'CH 20 GALV', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '740', '50', 'CH 20 GALV', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '850', '735', 'CH 22', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 2, '800', '150', 'CH 22', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '820', '60', 'CH 16', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 2, '790', '60', 'CH 16', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 6, '720', '20', 'CH 14', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 6, '710', '20', 'CH 14', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 4, '140', '100', 'CH 16', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 4, '750', '100', 'CH 16', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0521' AND pai."nome" = 'FORNO PARA PIZZA PRP 770 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 1, '550', '270', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '330', '360', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '160', '160', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '190', '125', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '288', '108', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '160', '30', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2158' AND pai."nome" = 'CAIXA LEITURA ÓPTICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1510', '110', 'CH 20 FF', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20 FF', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 3, '770', '110', 'CH 20 FF', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1490', '110', 'CH 20 FF', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1460', '90', 'CH 20 FF', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '740', '90', 'CH 20 FF', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 3, '680', '90', 'CH 20 FF', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 6, '1020', '90', 'CH 20 FF', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 8, '735', '40', 'CH 20 FF', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 4, '730', '80', 'CH 20 FF', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 8, '410', '50', 'CH 20 FF', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '100', '30', 'CH 16 FF', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 4, '150', '100', 'CH 20 FF', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 4, '700', '100', 'CH 20 FF', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '55', '55', 'CH 20 FF', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 3, '75', '75', 'CH 20 FF', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 4, '770', '315', 'CH 28 FF', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5558' AND pai."nome" = 'FOGÃO 08 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'TETO', 1, '2280', '570', 'CH GALVANIZADA 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL', 2, '635', '580', 'CH GALVANIZADA 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO L COSTA', 1, '2735', '220', 'CH GALVANIZADA 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO L FRENTE', 1, '2655', '220', 'CH GALVANIZADA 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA DA BASE', 1, '3000', '425', 'CH GALVANIZADA 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COMPLEMENTO DA BASE', 2, '425', '130', 'CH GALVANIZADA 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LUMINARIA DO DIGITAL', 1, '1935', '130', 'CH GALVANIZADA 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERFIL DE ENCAIXE', 4, '320', '60', 'CH GALVANIZADA 28', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERFIL DE ENCAIXE', 2, '90', '60', 'CH GALVANIZADA 28', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 1, '2210', '840', 'CH INOX 28', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '730', '520', 'CH INOX 28', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COMPLEMENTO DO TETO', 1, '1800', '140', 'CH INOX 28', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO', 1, '2000', '370', 'CH INOX 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA DO FUNDO', 6, '660', '410', 'CH INOX 28', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ESPELHO DA BANDEJA', 2, '2000', '80', 'CH INOX 28', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '1690', '90', 'CH INOX 28', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 1, '1690', '35', 'CH INOX 28', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 1, '1690', '50', 'CH INOX 28', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 1, '1690', '70', 'CH INOX 28', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 1, '1690', '35', 'CH INOX 28', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 1, '1690', '50', 'CH INOX 28', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA U', 2, '595', '110', 'CH INOX 28', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'CAIXA PARA EVAPORADOR', 1, '1930', '330', 'CH INOX 28', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 24', 2, '350', '150', 'CH INOX 28', 23
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 25', 1, '1990', '130', 'CHAPA PRETA / GALVANIZADA 20', 24
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 26', 4, '580', '150', 'CHAPA PRETA / GALVANIZADA 20', 25
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 27', 1, '300', '100', 'CHAPA PRETA / GALVANIZADA 20', 26
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 28', 1, '300', '70', 'CHAPA PRETA / GALVANIZADA 20', 27
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2612' AND pai."nome" = 'BALCÃO TENDAL 2000MM - SLIM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PÉ', 4, '740', '505', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '820', '680', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1300', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '560', '200', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 8, '510', '130', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '470', '460', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '410', '680', 'CH 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 2, '445', '405', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '360', '60', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 8, '398', '65', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '787', '70', 'CH 24', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '815', '445', 'CH 24', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1300', '535', 'INOX 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2935' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO COM PARA-CHOQUE COM APOIO PARA SUPORTE 1300MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1570', '140', 'CH 18 FF', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1080', '140', 'CH 18 FF', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '1060', '140', 'CH 18 FF', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1550', '140', 'CH 18 FF', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '1540', '140', 'CH 18 FF', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '1020', '90', 'CH 18 FF', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1510', '90', 'CH 18 FF', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '960', '90', 'CH 18 FF', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 4, '150', '150', 'CH 18 FF', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 4, '700', '150', 'CH 18 FF', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 4, '102', '90', 'CH 18 FF', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '75', '75', 'CH 18 FF', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '55', '55', 'CH 18 FF', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 6, '1010', '40', 'CH 18 FF', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 6, '510', '50', 'CH 18 FF', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 4, '1000', '80', 'CH 22 FF', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 6, '270', '20', 'CH 18 FF', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '100', '30', 'CH 16 FF', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 28', 3, '1040', '435', 'CH 28 FF', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5044' AND pai."nome" = 'FOGÃO DE 06 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1195', '105', 'CH 22 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '605', '105', 'CH 22 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 7, '605', '80', 'CH 22 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1105', '85', 'CH 22 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '605', '75', 'CH 22 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '850', '150', 'CH 22 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1270', '770', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11193' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1200X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1870', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 4, '770', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1490', '110', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1820', '90', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '740', '90', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 5, '720', '80', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '680', '90', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 8, '102', '90', 'CH 20', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 10, '410', '50', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '100', '30', 'CH 16', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 10, '735', '40', 'CH 20', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 4, '75', '75', 'CH 20', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 2, '55', '55', 'CH 20', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '700', '100', 'CH 20', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 4, '150', '100', 'CH 20', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 5, '770', '315', 'CH 28 PRETO OU GALV', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 1, '720', '360', 'CH 12', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 2, '700', '80', 'CH 20', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6529' AND pai."nome" = 'FOGÃO COM 8 BOCAS COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL MAIOR', 2, '1700', '270', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL MENOR', 2, '610', '270', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BACIA', 1, '1950', '825', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO', 1, '1760', '350', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LONGARINA', 1, '1750', '170', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MAIOR', 4, '535', '75', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MENOR', 5, '325', '75', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '190', '90', 'CH 22 INOX', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA BACIA', 2, '194', '570', 'CH 28 GALVANIZADA', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PROTEÇÃO DA PARTE ELÉTRICA', 1, '570', '560', 'CH 28 GALVANIZADA', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9225' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX COM 10 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V - VERMELHO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1150', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '770', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '780', '110', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '150', '100', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '700', '100', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1100', '90', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '740', '90', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 3, '720', '80', 'CH 20', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 6, '410', '50', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '75', '75', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '100', '30', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '55', '55', 'CH 20', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 2, '680', '90', 'CH 20', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 6, '735', '40', 'CH 20', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 4, '102', '90', 'CH 20', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 3, '770', '315', 'CH 28 PRETA OU GALV', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 1, '720', '360', 'CH 12', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5713' AND pai."nome" = 'FOGÃO COM 4 BOCAS, COM CHAPA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1570', '140', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '590', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '570', '140', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '1510', '90', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '530', '90', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '150', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '150', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 6, '525', '40', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 6, '102', '90', 'CH 18', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 3, '510', '50', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 3, '270', '20', 'CH 20', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '520', '80', 'CH 22', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9927' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'CORPO', 1, '755', '460', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 1, '423', '160', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '423', '50', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 2, '415', '100', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 2, '390', '100', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'GAVETA', 1, '495', '440', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '438', '138', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 2, '350', '35', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 4, '390', '30', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5207' AND pai."nome" = 'GAVETEITO CHECKOUT'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1150', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '425', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '400', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '1100', '90', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '375', '90', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '100', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '100', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 3, '410', '50', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 4, '102', '90', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 3, '365', '80', 'CH 22', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 6, '370', '40', 'CH 20', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 3, '315', '405', 'CH 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9926' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 03 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PERNA', 2, '1060', '', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO CONCHA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA TRASEIRA', 2, '435', '', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO CONCHA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 2, '397', '', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO CONCHA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'AMARRAÇÃO', 2, '397', '', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO CONCHA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '2450', '140', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1080', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '2430', '140', 'CH 8', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '2430', '120', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1060', '140', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 6, '50', '50', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1020', '90', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 9, '2390', '90', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 9, '1000', '80', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 10, '510', '50', 'CH 22', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 20, '80', '25', 'CH 22', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 10, '1010', '40', 'CH 18', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '150', 'CH 18', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '150', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 3, '100', '30', 'CH 16', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 8, '100', '90', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 4, '440', '1M', 'CH 28', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 4, '1M', '330', 'CH 28', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 2, '700', '90', 'CH 18', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9095' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 08 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 3, '1463', '105', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '1463', '130', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 4, '343', '105', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '250', '70', 'CH 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1453', '70', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '220', '55', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '660', '55', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '560', '55', 'CH 28', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 3, '1340', '55', 'CH 28', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3328' AND pai."nome" = 'PORTA P/ ARMÁRIO VITRINE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'ASSADEIRA', 1, '1695', '565', 'CHAPA 3/16 FQ', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BATEDOR', 1, '1535', '20', 'CHAPA 14 FQ', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ESCORREDOR DE GORDURA PEÇA 2', 1, '150', '50', 'CHAPA 18 FF', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ESCORREDOR DE GORDURA PEÇA 1', 1, '275', '25', 'CHAPA 18 FF', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA DO QUEIMADOR', 1, '1558', '450', 'CHAPA 24 FF', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO 1', 2, '445', '6', 'CHAPA 24 FF', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO 2', 2, '395', '40', 'CHAPA 24 FF', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'CAIXA', 1, '450', '120', 'CHAPA 24 FF', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE GRANDE', 1, '1500', '165', 'CHAPA INOX 28', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '2520', '130', 'CHAPA INOX 28', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE PEQUENA', 1, '210', '165', 'CHAPA INOX 28', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 3760' AND pai."nome" = 'CHAPA BIFETEIRA 1600X570MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1895', '105', 'CH 22 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '805', '105', 'CH 22 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 11, '805', '80', 'CH 22 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1805', '85', 'CH 22 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '805', '75', 'CH 22 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '850', '150', 'CH 22 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1970', '770', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10510' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX - 1900X900X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1960', '140', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1080', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 3, '1060', '140', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1550', '120', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1900', '90', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '1020', '90', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 7, '1000', '80', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 8, '1010', '40', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 3, '960', '90', 'CH 18', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 3, '75', '75', 'CH 18', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 6, '102', '90', 'CH 18', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 3, '100', '30', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 6, '390', '50', 'CH 18', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 2, '290', '50', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 16, '80', '25', 'CH 18', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 2, '50', '50', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 4, '700', '150', 'CH 18', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '700', '110', 'CH 18', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 4, '150', '150', 'CH 18', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 6, '270', '20', 'CH 18', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 1, '960', '360', 'CH 12', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11150' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PÉ', 4, '740', '505', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '820', '680', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1500', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '560', '200', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 10, '510', '130', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '410', '680', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 2, '445', '405', 'CH 24', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA LATERAL', 1, '470', '460', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '360', '60', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 8, '398', '65', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '780', '70', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 1, '815', '445', 'CH 24', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1500', '535', 'INOX 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 10557' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1500MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL', 2, '1045', '475', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA', 1, '1045', '915', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PORTA', 2, '937', '495', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 1, '920', '475', 'CH 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO SUPERIOR', 1, '9450', '460', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO INFERIOR', 1, '9450', '4150', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '850', '100', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA DA PORTA', 2, '855', '80', 'CH 28', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA DA BANDEJA', 2, '890', '80', 'CH 28', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8532' AND pai."nome" = 'ARMÁRIO ANÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '350', '', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3693' AND pai."nome" = 'MESA MELAMINICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '679', '', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3693' AND pai."nome" = 'MESA MELAMINICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '679', '', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3693' AND pai."nome" = 'MESA MELAMINICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '470', '', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3693' AND pai."nome" = 'MESA MELAMINICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1490', '', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8541' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '1120', '', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8541' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '300', '', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8541' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '730', '1145', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1640', '810', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '1700', '110', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1700', '150', 'CH 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '1300', '850', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '1500', '130', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '1700', '540', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '1710', '80', 'CH 28', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 1, '1700', '110', 'CH 26', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '1700', '150', 'CH 26', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '1500', '85', 'CH 26', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '1500', '130', 'CH 26', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 1, '1710', '830', 'CH 26', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 1, '1740', '410', 'CH 26', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 1, '1760', '600', 'CH 28 GALVANIZADA', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '1700', '540', 'CH 28 GALVANIZADA', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 1, '1640', '1200', 'CH 28 GALVANIZADA', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 1, '1640', '540', 'CH 28 GALVANIZADA', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 2, '1370', '40', 'CH 28 GALVANIZADA', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 4, '1400', '40', 'CHAPA 20', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 8, '1400', '100', 'CHAPA 20', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 2, '480', '100', 'CHAPA 20', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 1, '450', '60', 'CHAPA 20', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12297' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 03 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 4, '590', '140', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 4, '530', '90', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '390', '50', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '80', '25', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '525', '40', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '520', '80', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '150', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '150', '700', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6898' AND pai."nome" = 'FOGÃO COM 1 BOCA DUPLA GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '2060', '140', 'CH 18 FF', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1080', '140', 'CH 18 FF', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 3, '1060', '140', 'CH 18 FF', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '2040', '140', 'CH 18 FF', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '2040', '120', 'CH 18 FF', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '2000', '90', 'CH 18 FF', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1020', '90', 'CH 18 FF', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '700', '150', 'CH 18 FF', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 4, '150', '150', 'CH 18 FF', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 3, '960', '90', 'CH 18 FF', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 3, '75', '75', 'CH 18 FF', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 8, '510', '50', 'CH 18 FF', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 8, '1010', '40', 'CH 18 FF', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 6, '102', '90', 'CH 18 FF', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '100', '30', 'CH 16 FF', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 2, '50', '50', 'CH 18 FF', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 7, '1000', '80', 'CH 18 FF', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '700', '110', 'CH 18 FF', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 8, '270', '13', 'CH 18 FF', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8834' AND pai."nome" = 'FOGÃO DE 08 BOCAS DUPLAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'TAMPO', 1, '1590', '790', 'CH 22 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA P/ TAMPO', 5, '680', '120', 'CH 22 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '1420', '75', 'CH 18 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '620', '75', 'CH 18 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 14, '680', '120', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1500', '70', 'CH 18 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1460', '70', 'CH 18 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '1455', '65', 'CH 28 INOX', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '80', '45', 'CH 18 INOX', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6538' AND pai."nome" = 'MESA P/PIZZA 1500X700X900 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '470', '', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1229' AND pai."nome" = 'PÉ PARA CADEIRA CAIXA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '420', '', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1229' AND pai."nome" = 'PÉ PARA CADEIRA CAIXA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1490', '', 'CH 1.20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4406' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1120', '', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4406' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '300', '', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4406' AND pai."nome" = 'CADEIRA FIXA ESTOFADA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '600', '370', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2428' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '108', '330', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2428' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '108', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2428' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '147', '160', 'PRÉ-PINTADA', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2428' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '147', '240', 'PRÉ-PINTADA', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2428' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1500 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1915', '710', 'PRÉ-PINTADA', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1875', '445', 'PRÉ-PINTADA', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '690', '445', 'PRÉ-PINTADA', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1975', '770', 'CH GALV 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '1875', '500', 'CH GALV 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '925', '500', 'CH GALV 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '180', '480', 'CH PRETA 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '700', '480', 'CH PRETA 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9217' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 2000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '425', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '400', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '375', '90', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '740', '90', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '410', '50', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '150', '100', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '700', '100', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '102', '90', 'CH 20', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 4, '370', '40', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '100', '30', 'CH 16', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 3, '365', '80', 'CH 22', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '315', '405', 'CH 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9917' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '2350', '140', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1080', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 4, '1060', '140', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1550', '140', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '1550', '120', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '1020', '90', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '2290', '90', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '960', '90', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 8, '102', '90', 'CH 18', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 6, '390', '50', 'CH 18', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 4, '290', '50', 'CH 18', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 7, '1000', '80', 'CH 18', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '55', '55', 'CH 18', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 4, '150', '150', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '700', '150', 'CH 18', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 4, '700', '110', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 4, '75', '75', 'CH 18', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 4, '100', '30', 'CH 16', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 20, '80', '25', 'CH 16', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 10, '1010', '40', 'CH 18', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 1, '940', '360', 'CH 12', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 3, '1040', '440', 'CH 28', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 2, '1040', '350', 'CH 28', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11148' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 06 BOCAS DUPLAS COM FORNO, CHAPA E BANHO MARIA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PÉ', 4, '740', '505', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '820', '680', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1800', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '560', '200', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 12, '510', '130', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '410', '680', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 2, '445', '405', 'CH 24', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA LATERAL', 1, '790', '460', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '360', '60', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 8, '398', '65', 'CH 22', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '780', '70', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 1, '815', '445', 'CH 24', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1800', '535', 'INOX 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12197' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE COM APOIO PARA SUPORTE COM GAVETA 1800 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1510', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 3, '770', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1140', '110', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '1460', '90', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '740', '90', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '100', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '100', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 4, '720', '80', 'CH 20', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 8, '290', '50', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 16, '80', '25', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '100', '30', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 9, '102', '90', 'CH 20', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 8, '735', '40', 'CH 20', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 4, '760', '325', 'CH 28 GALV. OU PRETO', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 3, '680', '90', 'CH 22', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 3, '75', '75', 'CH 22', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '90', '50', 'CH 18 OU 16', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6517' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES GRELHA 30X30 MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '600', '37', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9213' AND pai."nome" = 'BALCÃO CAIXA MELAMINICO STANDER 700 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '480', '330', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9213' AND pai."nome" = 'BALCÃO CAIXA MELAMINICO STANDER 700 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '480', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9213' AND pai."nome" = 'BALCÃO CAIXA MELAMINICO STANDER 700 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '167', '160', 'PRÉ-PINTADA', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9213' AND pai."nome" = 'BALCÃO CAIXA MELAMINICO STANDER 700 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1', '240', 'PRÉ-PINTADA', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9213' AND pai."nome" = 'BALCÃO CAIXA MELAMINICO STANDER 700 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 40, '710', '145', 'CH 26', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '585', '705', 'CH 26', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1840', '670', 'CH 26', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PORTA', 1, '1810', '685', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '605', '100', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '1820', '40', 'CH 14', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '628', '40', 'CH 14', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 1, '587', '40', 'CH 16', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TREVO', 1, '140', '70', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '617', '70', 'CH 22', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0643' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 05 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 4, '790', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '770', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 8, '740', '90', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '150', '100', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '700', '100', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 3, '720', '80', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '735', '40', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '102', '90', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '75', '75', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '55', '55', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 1, '680', '90', 'CH 20', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '770', '315', 'CH 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 4, '410', '50', 'CH 20', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9929' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 04 BOCAS SIMPLES GRELHA 30X30 PERFIL 70MM ECONÔMICO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '600', '370', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2434' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '480', '330', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2434' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '480', '200', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2434' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PONTALETE', 1, '167', '160', 'PRÉ-PINTADA', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2434' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '167', '240', 'PRÉ-PINTADA', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 2434' AND pai."nome" = 'BALCÃO VITRINE ESTUFA NATURAL STANDER 1200 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'FUNDO INTERNO', 1, '1190', '730', 'CH 28 PRÉ-PINTADO', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1640', '1145', 'CH 28 PRÉ-PINTADO', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE INTERNO', 1, '1145', '150', 'CH 28 PRÉ-PINTADO', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE INTERNO', 1, '1145', '110', 'CH 28 PRÉ-PINTADO', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNA INTERNO', 2, '1500', '85', 'CH 28 PRÉ-PINTADO', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE INTERNO', 1, '1500', '130', 'CH 28 PRÉ-PINTADO', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO EXTERNO', 2, '1160', '80', 'CH 28 PRÉ-PINTADO', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO INTEIRO', 1, '1145', '540', 'CH 28 PRÉ-PINTADO', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO INFERIOR EXTERNO', 1, '1155', '230', 'CH 28 INOX', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO SUPERIOR EXTERNO', 1, '1205', '410', 'CH 28 INOX', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE  EXTERNO', 1, '1145', '110', 'CH 28 INOX', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE  EXTERNO', 1, '1145', '150', 'CH 28 INOX', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNAS  EXTERNO', 2, '1500', '85', 'CH 28 INOX', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNAS  EXTERNO', 1, '1500', '130', 'CH 28 INOX', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO EXTERNO', 1, '1210', '600', 'CH 28 GALVANIZADA', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO EXTERNO', 1, '1145', '540', 'CH 28 GALVANIZADA', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1640', '1145', 'CH 28 GALVANIZADA', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '750', '510', 'CH 28 GALVANIZADA', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL', 2, '420', '160', 'CH 28 GALVANIZADA', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA COLUNA', 4, '1400', '40', 'CH 26', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA COLUNA EXTERNO', 5, '1400', '100', 'CH 26', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA BACIA', 2, '500', '100', 'CH 26', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DO TETO', 1, '600', '450', 'CH 26', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12377' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO VIDRO DUPLO COM 02 PORTAS LATERAL POLIPROPILENO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1495', '105', 'CH 22 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '605', '105', 'CH 22 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 9, '605', '80', 'CH 22 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1405', '85', 'CH 22 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '605', '75', 'CH 22 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '850', '150', 'CH 22 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1570', '770', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11330' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TOTAL INOX 1500X700X850 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1810', '960', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '1015', '400', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '1330', '60', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1030', '150', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '370', '90', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '750', '310', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '750', '310', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '1730', '960', 'CH 28 GALV', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 1, '1030', '380', 'CH 28 GALV', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 2, '980', '315', 'CH 28 GALV', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '870', '110', 'CH 28 GALV', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '870', '60', 'CH 18 GALV', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 1, '960', '120', 'CH 18 GALV', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 1, '995', '930', 'CH 20 FF', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '925', '150', 'CH 20 FF', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 2, '1020', '60', 'CH 16 FF', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 2, '910', '60', 'CH 16 FF', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 6, '910', '20', 'CH 14', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 7, '865', '20', 'CH 14', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 4, '750', '100', 'CH 16 FF', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 4, '140', '100', 'CH 16 FF', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0523' AND pai."nome" = 'FORNO PARA PIZZA PRP 900 INOX'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1895', '105', 'CH 22 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '605', '105', 'CH 22 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 11, '605', '80', 'CH 22 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1805', '85', 'CH 22 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '605', '75', 'CH 22 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '850', '150', 'CH 22 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '1970', '770', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11388' AND pai."nome" = 'MESA PARA PANIFICAÇÃO TAMPO INOX ESTRUTURA METALON 40X40 PINTADA 1900X700X850MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '1150', '110', 'CH 20', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '790', '110', 'CH 20', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '770', '110', 'CH 20', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1130', '110', 'CH 20', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '150', '100', 'CH 20', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '700', '100', 'CH 20', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 4, '1100', '90', 'CH 20', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '740', '90', 'CH 20', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 3, '720', '80', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 6, '410', '50', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '75', '75', 'CH 20', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '100', '30', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '55', '55', 'CH 20', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 2, '68', '90', 'CH 20', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '102', '90', 'CH 20', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 6, '735', '40', 'CH 20', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 3, '770', '315', 'CH 28', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-2045' AND pai."nome" = 'FOGÃO COM 6 BOCAS SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 2, '1080', '140', 'CH 20 OU 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '590', '140', 'CH 20 OU 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '530', '90', 'CH 20 OU 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '570', '140', 'CH 20 OU 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '1020', '90', 'CH 20 OU 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA', 4, '700', '150', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PÉ', 4, '150', '150', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 4, '525', '40', 'CH 20 OU 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '102', '90', 'CH 20 OU 18', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '510', '50', 'CH 20', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '100', '30', 'CH 16', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 3, '520', '80', 'CH 22', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 2, '530', '435', 'CH 28 PRETO OU GALVANIZADO', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '270', '20', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 9916' AND pai."nome" = 'FOGÃO INDUSTRIAL COM 02 BOCAS DUPLAS GRELHA 40X40 PERFIL 100MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 2, '2090', '715', 'CROMO INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '2860', '490', 'CROMO INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 4, '1500', '150', 'CROMO INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '1500', '85', 'CROMO INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '2815', '110', 'CROMO INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 1, '2815', '150', 'CROMO INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '2825', '230', 'CROMO INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '2815', '150', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 1, '2815', '110', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 4, '1500', '130', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '1500', '85', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 1, '2860', '720', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '2830', '100', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 2, '1640', '1200', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 1, '1640', '495', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '2815', '540', 'PRÉ-PINTADO BRANCO 28 OU PRETO', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 2, '2070', '595', 'LATERAL EXTERNA', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 2, '1640', '1020', 'GALVANIZADO 28', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 1, '1640', '855', 'GALVANIZADO 28', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 1, '2815', '540', 'GALVANIZADO 28', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 4, '570', '40', 'GALVANIZADO 28', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 1, '2870', '600', 'FUNDO', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 14, '1400', '100', 'CHAPA PRETA 20', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 24', 4, '1400', '40', 'CHAPA PRETA 20', 23
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 25', 3, '480', '110', 'CHAPA PRETA 20', 24
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 26', 1, '600', '450', 'CHAPA PRETA 20', 25
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12446' AND pai."nome" = 'BALCÃO AUTO SERVIÇO AR FORÇADO CROMINOX VIDRO DUPLO COM 05 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1320', '755', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '545', '490', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '545', '250', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '305', '70', 'CH 16 AF', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '538', '25', 'CH 16 AF', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '110', '70', 'CH 16 AF', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '1105', '693', 'CH 28 GALVANIZADO', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '545', '280', 'CH 28 GALVANIZADO', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 4, '600', '60', 'CH 28 GALVANIZADO', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '520', '655', 'CH 28 GALVANIZADO', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '660', '40', 'CH 28 GALVANIZADO', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '590', '25', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '485', '25', 'CH 16', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 5, '580', '10', 'CH 16', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '485', '10', 'CH 16', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '70', '20', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5348' AND pai."nome" = 'FORNO GRANDE PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1320', '590', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 1, '545', '490', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '545', '250', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '305', '70', 'CH 16', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '110', '70', 'CH 16', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 1, '538', '25', 'CH 16', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '1105', '530', 'CH 28 GALVANIZADO', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '545', '280', 'CH 28 GALVANIZADO', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 4, '450', '60', 'CH 28 GALVANIZADO', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '520', '500', 'CH 28 GALVANIZADO', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '500', '40', 'CH 28 GALVANIZADO', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 2, '450', '25', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '485', '25', 'CH 16', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 5, '445', '10', 'CH 16', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 4, '485', '10', 'CH 16', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '70', '20', 'CH 18', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-8876' AND pai."nome" = 'FORNO PEQUENO PARA FOGÃO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1 M', '', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-9790' AND pai."nome" = 'MEDIDAS QUEIMADOR 900'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '880', '', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-9790' AND pai."nome" = 'MEDIDAS QUEIMADOR 900'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '618', '', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-9790' AND pai."nome" = 'MEDIDAS QUEIMADOR 900'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 6, '730', '', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-9790' AND pai."nome" = 'MEDIDAS QUEIMADOR 900'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '860', '', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-9790' AND pai."nome" = 'MEDIDAS QUEIMADOR 900'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1490', '', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6486' AND pai."nome" = 'PESCOÇO PARA CADEIRA FIXA, SECRETARIA, CAIXA E LONGARINA'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL MAIOR', 2, '1040', '270', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL MENOR', 2, '610', '270', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BACIA', 1, '1280', '825', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO', 1, '1120', '350', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LONGARINA', 1, '1090', '170', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MAIOR', 2, '535', '75', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MENOR', 3, '325', '75', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '190', '90', 'CH 22 INOX OU GALVANIZADA', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA BACIA', 2, '194', '570', 'CH 28 GALVANIZADA', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PROTEÇÃO DA PARTE ELÉTRICA', 1, '570', '560', 'CH 28 GALVANIZADA', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12416' AND pai."nome" = 'BALCÃO TÉRMICO SELF-SERVICE EM INOX DE BANCADA COM 06 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO - 220 V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '1270', '', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5634' AND pai."nome" = 'MEDIDAS QUEIMADOR 1300'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1150', '', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5634' AND pai."nome" = 'MEDIDAS QUEIMADOR 1300'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '618', '', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5634' AND pai."nome" = 'MEDIDAS QUEIMADOR 1300'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 6, '730', '', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5634' AND pai."nome" = 'MEDIDAS QUEIMADOR 1300'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '1050', '', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-5634' AND pai."nome" = 'MEDIDAS QUEIMADOR 1300'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'COLUNA', 4, '2500', '58', 'CH 16 FF', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12310' AND pai."nome" = 'ESTANTE 2500X1200X500MM COLUNA CH 16 BANDEJA CH18'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 5, '1280', '575', 'CH 18 FF', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12310' AND pai."nome" = 'ESTANTE 2500X1200X500MM COLUNA CH 16 BANDEJA CH18'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 10, '1170', '70', 'CH 28 FF', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12310' AND pai."nome" = 'ESTANTE 2500X1200X500MM COLUNA CH 16 BANDEJA CH18'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'COSTA EXTERNA', 1, '1490', '890', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA INTERNA', 1, '1470', '855', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO INTERNO', 1, '1470', '760', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BATENTE FRENTE', 1, '1435', '300', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO EXTERNO', 1, '1470', '640', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO COLUNA', 1, '140', '370', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO BASE', 2, '580', '70', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO LATERAL BASE', 2, '695', '365', 'CH 28 INOX', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COBERTURA DO CANO', 1, '700', '130', 'CH 28 INOX', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SUPORTE EVAPORADOR', 2, '1420', '150', 'CH 28 INOX', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 4, '630', '450', 'CH 28 INOX', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '545', '100', 'CH 28 INOX', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '90', 'CH 28 INOX', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '60', 'CH 28 INOX', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '50', 'CH 28 INOX', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '70', 'CH 28 INOX', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '40', 'CH 28 INOX', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1125', '30', 'CH 28 INOX', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'APOIO DO VIDRO', 2, '130', '60', 'CH 28 INOX', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO FRENTE BASE', 1, '1430', '365', 'CH 28 GALVANIZADA', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO EXTERNO', 1, '1490', '840', 'CH 28 GALVANIZADA', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO INTEIRO', 1, '1480', '515', 'CH 28 GALVANIZADA', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BASE', 3, '1185', '140', 'CH 20 GALVANIZADA', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '600', '100', 'CH 20 PRETO', 23
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '1120', '20', 'CH 20 PRETO', 24
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '540', '20', 'CH 20 PRETO', 25
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4116' AND pai."nome" = 'BALCÃO TENDAL 1500'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PERNA', 2, '1060', '', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214-2' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PERNA TRASEIRA', 2, '435', '', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214-2' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 2, '397', '', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214-2' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'AMARRAÇÃO', 2, '397', '', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12214-2' AND pai."nome" = 'CADEIRA FIXA ASSENTO E ENCOSTO EM POLIPROPILENO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '294', '710', 'PRÉ-PINTADA/CH PRETA', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '290', '445', 'PRÉ-PINTADA/CH PRETA', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '690', '445', 'PRÉ-PINTADA/CH PRETA', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '290', '500', 'PRÉ-PINTADA/CH PRETA', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 2, '925', '500', 'PRÉ-PINTADA/CH PRETA', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 1, '3000', '770', 'CH GALV 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '280', '180', 'CH PRETA 20 OU 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '650', '480', 'CH PRETA 20 OU 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8771' AND pai."nome" = 'ILHA PARA CONGELADOS PRÉ-PINTADA 3000 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'COSTAS INTERNA', 2, '1640', '1145', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '2255', '150', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '2255', '11', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNA', 2, '1500', '85', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNA', 3, '1500', '130', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 1, '2300', '730', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO', 2, '2270', '80', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO', 1, '2255', '540', 'CHAPA PRÉ-PINTADA / CHAPA PRETA', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '2255', '110', 'CROMINOX', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 1, '2255', '150', 'CROMINOX', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNA', 2, '1500', '85', 'CROMINOX', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COLUNA', 3, '1500', '130', 'CROMINOX', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO DA FRENTE', 1, '2300', '410', 'CROMINOX', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ACABAMENTO DA FRENTE', 1, '2265', '230', 'CROMINOX', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA EXTERNA', 2, '1640', '740', 'CH GALVANIZADA 28', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA EXTERNA', 1, '1640', '855', 'CH GALVANIZADA 28', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TETO', 1, '2255', '540', 'CH GALVANIZADA 28', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 1, '2300', '600', 'CH GALVANIZADA 28', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ENCAIXE', 3, '1570', '40', 'CH GALVANIZADA 28', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 8, '1200', '100', 'CH PRETA / GALVANIZADA 20', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 3, '1400', '100', 'CH PRETA / GALVANIZADA 20', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 4, '1400', '40', 'CH PRETA / GALVANIZADA 20', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 1, '600', '450', 'CH PRETA / GALVANIZADA 20', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 24', 3, '480', '100', 'CH PRETA / GALVANIZADA 20', 23
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-6318' AND pai."nome" = 'BALCÃO AR-FORÇADO 4 PORTAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL', 2, '1350', '600', 'CH 28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 1, '1335', '485', 'CH 28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '620', '547', 'CH 28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 1, '460', '110', 'CH 28', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLEJO', 1, '1280', '23', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 4, '507', '375', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 4, '420', '120', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'GAVETA', 4, '590', '475', 'CH 28', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ORELHA', 1, '70', '20', 'CH 22 OU 20', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BATENTE', 1, '424', '105', 'CH 28', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 8284' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS ECONÔMICO 1330X460X540MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '490', '120', 'CROMO INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '2090', '715', 'CROMO INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 1, '1160', '200', 'CROMO INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 1, '1145', '110', 'CROMO INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '1145', '150', 'CROMO INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 2, '1500', '85', 'CROMO INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 1, '1500', '130', 'CROMO INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 1, '1190', '720', 'PRÉ-PINTADO PRETO OU BRANCO', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 1, '1640', '1145', 'PRÉ-PINTADO PRETO OU BRANCO', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '1145', '110', 'PRÉ-PINTADO PRETO OU BRANCO', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 2, '1500', '85', 'PRÉ-PINTADO PRETO OU BRANCO', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 1, '1500', '130', 'PRÉ-PINTADO PRETO OU BRANCO', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '1160', '90', 'PRÉ-PINTADO PRETO OU BRANCO', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 1, '1145', '540', 'PRÉ-PINTADO PRETO OU BRANCO', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '170', '420', 'PRÉ-PINTADO PRETO OU BRANCO', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 16', 1, '800', '510', 'PRÉ-PINTADO PRETO OU BRANCO', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 17', 1, '1210', '600', 'CH 28 GALVANIZADA', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 18', 1, '1145', '540', 'CH 28 GALVANIZADA', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 19', 1, '1640', '1145', 'CH 28 GALVANIZADA', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 20', 4, '1400', '40', 'CH 20 FF', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 21', 5, '1400', '100', 'CH 20 FF', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 22', 2, '500', '100', 'CH 20 FF', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 23', 1, '600', '450', 'CH 20 FF', 22
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-3468' AND pai."nome" = 'BALCÃO AR FORÇADO 2 PORTAS MODELO NOVO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL', 2, '1350', '700', 'CH  28', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA', 1, '1335', '485', 'CH  28', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TAMPO', 1, '720', '547', 'CH  28', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA FRENTE', 1, '425', '60', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BATENTE', 1, '424', '105', 'CH 28', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FRENTE', 4, '507', '375', 'CH 28', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 1, '460', '100', 'CH 28', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLEJO', 1, '1280', '23', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'GAVETA', 4, '590', '575', 'CH 28', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'FUNDO', 4, '420', '120', 'CH 28', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '425', '100', 'CH 28', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '70', '20', 'CH 20 OU 18', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 8, '580', '45', 'CH 22', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRILHO', 8, '580', '25', 'CH 22', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA GRANDE', 4, '1100', '80', 'CH 28', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'ORELHA', 8, '30', '20', 'CH 20', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12144' AND pai."nome" = 'ARQUIVO MONTÁVEL E DESMONTÁVEL DE AÇO COM 04 GAVETAS PARA PASTA SUSPENSA 1330X460X635 MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 4, '1080', '140', 'CH 18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '1060', '140', 'CH 18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 8, '1020', '90', 'CH 18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '700', '150', 'CH 18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 4, '150', '150', 'CH 18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '510', '50', 'CH 18', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '102', '90', 'CH 18', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 4, '1010', '40', 'CH 18', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 3, '1000', '80', 'CH 22', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 11', 1, '960', '90', 'CH 18', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 12', 1, '75', '75', 'CH 18', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 13', 2, '55', '55', 'CH 18', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 14', 4, '270', '20', 'CH 18', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 15', 2, '1040', '435', 'CH 28', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 11130' AND pai."nome" = 'FOGÃO INDUSTRIAL PERFIL 100 MM COM 04 BOCAS DUPLAS SEM FORNO'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PÉ', 4, '740', '505', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '910', '680', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA', 1, '820', '680', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 2, '905', '445', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BANDEJA', 1, '815', '445', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'SAIA LATERAL', 1, '1040', '460', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '560', '200', 'CH 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '500', '200', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '820', '200', 'CH 22', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 4, '510', '150', 'CH 28', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '2380', '170', 'CH 22', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '1060', '180', 'CH 22', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 5, '650', '100', 'CH 28', 12
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTELA', 2, '670', '100', 'CH 22', 13
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 7, '155', '100', 'CH 22', 14
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 4, '360', '60', 'CH 22', 15
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '780', '70', 'CH 20', 16
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 8, '398', '65', 'CH 20 OU 18', 17
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '90', '20', 'CH 20', 18
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '960', '60', 'CH 22', 19
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 1, '980', '745', 'INOX 28', 20
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '680', '100', 'INOX 28', 21
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12259' AND pai."nome" = 'CHECK-OUT PARA SUPERMERCADO LINHA MASTER COM PARA-CHOQUE 2000MM'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA', 40, '710', '145', 'CH 26', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '815', '705', 'CH 26', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'COSTA', 1, '1840', '900', 'CH 26', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PORTA', 2, '1810', '485', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO CABEÇA DAS PORTAS', 4, '415', '100', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'DIVISÃO', 40, '710', '75', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 8, '410', '100', 'CH 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '1820', '40', 'CH 14', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '858', '40', 'CH 14', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 2, '397', '40', 'CH 16', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVA', 1, '35', '20', 'CH 14', 10
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVA', 1, '100', '50', 'CH 16', 11
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0644' AND pai."nome" = 'CÂMARA ESTUFA COM 02 PORTAS PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 40 ASSADEIRAS COM 04 TIRAS - BRANCO BRILHANTE'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'LATERAL', 40, '710', '145', 'CH 26', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '705', '395', 'CH 26', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PORTA', 1, '1810', '490', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '415', '100', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA', 2, '423', '70', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '1820', '40', 'CH 14', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'MOLDURA', 2, '438', '40', 'CH 14', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'DIVISÃO', 1, '397', '40', 'CH 16', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 0642' AND pai."nome" = 'CÂMARA ESTUFA COM 01 PORTA PARA FERMENTAÇÃO DE PÃES COM CAPACIDADE PARA 20 ASSADEIRAS COM 04 TIRAS'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 1, '820', '', 'CH  18', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1722' AND pai."nome" = 'MEDIDAS QUEIMADOR 770'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 2, '682', '', 'CH  18', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1722' AND pai."nome" = 'MEDIDAS QUEIMADOR 770'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 2, '602', '', 'CH  18', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1722' AND pai."nome" = 'MEDIDAS QUEIMADOR 770'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 4, '730', '', 'CH  18', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1722' AND pai."nome" = 'MEDIDAS QUEIMADOR 770'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '700', '', 'CH  18', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-1722' AND pai."nome" = 'MEDIDAS QUEIMADOR 770'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'TETO', 1, '1430', '350', 'CH 28 INOX', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL MAIOR', 2, '270', '1370', 'CH 28 INOX', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LATERAL MENOR', 2, '270', '610', 'CH 28 INOX', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'BACIA', 1, '825', '1615', 'CH 28 INOX', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'LONGARINA', 1, '170', '1425', 'CH 28 INOX', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MAIOR', 3, '535', '75', 'CH 28 INOX', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'TRAVESSO MENOR', 4, '325', '75', 'CH 28 INOX', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO', 4, '190', '90', 'CH 22 INOX', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'REFORÇO DA BACIA', 2, '194', '570', 'CH 28 GALVANIZADA', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PROTEÇÃO DA PARTE  ELÉTRICA', 1, '570', '560', 'CH 28 GALVANIZADA', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PA 12417' AND pai."nome" = 'BALCAO TERMICO SELF SERVICE EM INOX DE BANCADA COM 08 CUBAS GN 1/2X100 COM TAMPAS EM VIDRO 220V'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

INSERT INTO "decomposicao_peca" ("paiId", "descricao", "quantidade", "medidaL", "medidaA", "materiaPrima", "sortOrder")
SELECT pai.id, 'PEÇA 01', 4, '425', '110', 'CH 22', 0
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 02', 8, '375', '90', 'CH 22', 1
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 03', 4, '150', '100', 'CH 22', 2
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 04', 2, '370', '40', 'CH 22', 3
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 05', 1, '410', '50', 'CH 22', 4
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 06', 4, '700', '100', 'CH 22', 5
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 07', 2, '365', '80', 'CH 22', 6
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 08', 2, '80', '25', 'CH 22', 7
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 09', 2, '100', '30', 'CH 16', 8
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
UNION ALL
SELECT pai.id, 'PEÇA 10', 1, '310', '310', 'CH 28 GALVANIZADA', 9
FROM "decomposicao_produto_pai" pai
WHERE pai."codigo" = 'PRD-4200' AND pai."nome" = 'FOGÃO COM 1 BOCA SIMPLES'
  AND NOT EXISTS (SELECT 1 FROM "decomposicao_peca" e WHERE e."paiId" = pai.id)
;

