import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: {
      data_ajuste: {
        gte: new Date('2026-06-01T18:30:00.000Z'),
        lte: new Date('2026-06-01T18:35:00.000Z'),
      },
    },
    orderBy: { id: 'asc' },
  });
  console.log('Jun 1 18:30-18:35 UTC:', rows.length);
  for (const r of rows) {
    console.log(
      `#${r.id} ${r.id_pedido} prev=${r.previsao_nova.toISOString().slice(0, 10)} ${r.motivo} user=${r.usuario} conf=${r.previsao_confiavel}`
    );
  }

  const may27 = await prisma.pedidoPrevisaoAjuste.findMany({
    where: {
      data_ajuste: {
        gte: new Date('2026-05-27T12:50:00.000Z'),
        lte: new Date('2026-05-27T12:55:00.000Z'),
      },
    },
  });
  console.log('\nMay 27 ~09:51 BRT:', may27.length);
  for (const r of may27) {
    console.log(`#${r.id} ${r.id_pedido} ${r.previsao_nova.toISOString().slice(0, 10)} ${r.motivo}`);
  }
}

main().finally(() => prisma.$disconnect());
