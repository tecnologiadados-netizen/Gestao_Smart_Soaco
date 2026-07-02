import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { id_pedido: { contains: '48552' }, rota: { not: null } },
    orderBy: [{ data_ajuste: 'desc' }],
  });
  console.log('overrides', rows.length);
  for (const r of rows) {
    console.log(r);
  }
  const rows2 = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { previsao_nova: { gte: new Date('2026-06-18'), lte: new Date('2026-06-20') } },
    orderBy: [{ data_ajuste: 'desc' }],
    take: 30,
  });
  console.log('\nall 18-19 jun previsao:');
  for (const r of rows2) {
    console.log(`#${r.id} ${r.id_pedido} prev=${r.previsao_nova.toISOString().slice(0, 10)} ${r.data_ajuste.toISOString().slice(0, 19)} — ${r.motivo}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
