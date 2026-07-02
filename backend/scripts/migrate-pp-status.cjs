const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const alters = [
  `ALTER TABLE programacao_producao_registro ADD COLUMN "linhaCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE programacao_producao_registro ADD COLUMN "status" TEXT NOT NULL DEFAULT 'em_processamento'`,
  `ALTER TABLE programacao_producao_registro ADD COLUMN "processadoAt" DATETIME`,
  `ALTER TABLE programacao_producao_registro ADD COLUMN "usuarioLoginProcessado" TEXT`,
  `ALTER TABLE programacao_producao_registro ADD COLUMN "concluidoAt" DATETIME`,
  `ALTER TABLE programacao_producao_registro ADD COLUMN "usuarioLoginConcluido" TEXT`,
];

(async () => {
  for (const sql of alters) {
    try {
      await p.$executeRawUnsafe(sql);
      console.log('OK:', sql.slice(0, 60));
    } catch (e) {
      console.log('SKIP:', e.message?.slice(0, 80));
    }
  }
  await p.$disconnect();
})();
