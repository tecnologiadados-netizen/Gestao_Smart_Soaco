import { prisma } from '../src/config/prisma.js';

async function main() {
  const ids = process.argv.slice(2).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    console.error('Informe IDs: npx tsx scripts/remover-sequenciamento-snapshots.ts 1 2');
    process.exit(1);
  }
  const rows = await prisma.sequenciamentoCarradasSnapshot.findMany({ where: { id: { in: ids } } });
  for (const r of rows) {
    console.log(`Removendo #${r.id} ${r.cod} (${r.usuarioLogin})`);
  }
  const deleted = await prisma.sequenciamentoCarradasSnapshot.deleteMany({ where: { id: { in: ids } } });
  console.log(`Total removido: ${deleted.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
