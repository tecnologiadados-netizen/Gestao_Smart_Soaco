import { prisma } from '../src/config/prisma.js';

async function main() {
  const desde = new Date('2026-06-01T00:00:00Z');
  const ate = new Date('2026-06-02T00:00:00Z');
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: {
      data_ajuste: { gte: desde, lt: ate },
      usuario: 'master',
    },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  const pd = '48552';
  for (const r of rows) {
    if (!r.id_pedido.includes(pd)) continue;
    console.log(
      `#${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} — ${r.motivo}`
    );
  }
  console.log('--- todos master 01/06 com 19/06 ---');
  for (const r of rows) {
    if (r.previsao_nova.toISOString().slice(0, 10) !== '2026-06-19') continue;
    console.log(`#${r.id} ${r.id_pedido} — ${r.motivo}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
