import { initPainelProducaoMetas } from '../src/services/painelProducao/painelProducaoTargetsService.js';
import { prisma } from '../src/config/prisma.js';

async function main() {
  await initPainelProducaoMetas();
  const metas = await prisma.painelProducaoMeta.count();
  const meses = await prisma.painelProducaoMes.count();
  console.log(`Seed OK: ${metas} metas, ${meses} meses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
