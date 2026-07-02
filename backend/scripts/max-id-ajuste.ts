import { prisma } from '../src/config/prisma.js';

async function main() {
  const max = await prisma.pedidoPrevisaoAjuste.findFirst({ orderBy: { id: 'desc' } });
  console.log('max id', max?.id);
  const recent = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { id: { gte: 17290 } },
    orderBy: { id: 'asc' },
  });
  for (const r of recent) {
    console.log(`#${r.id} ${r.id_pedido} ${r.previsao_nova.toISOString().slice(0, 10)} ${r.motivo}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
