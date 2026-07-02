import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.sequenciamentoCarradasSnapshot.findMany({ orderBy: { id: 'asc' } });
  for (const r of rows) {
    console.log(`#${r.id} ${r.cod} ${r.usuarioLogin} ${r.createdAt.toISOString()} carradas=${r.carradaCount}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
