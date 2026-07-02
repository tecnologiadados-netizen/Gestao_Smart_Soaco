import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { motivo: { contains: 'produ' } },
    orderBy: [{ data_ajuste: 'desc' }],
  });
  for (const r of rows) {
    if (!r.id_pedido.includes('48552')) continue;
    console.log(`#${r.id} ${r.id_pedido} prev=${r.previsao_nova.toISOString().slice(0, 10)} ${r.data_ajuste.toISOString()} — ${r.motivo}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
