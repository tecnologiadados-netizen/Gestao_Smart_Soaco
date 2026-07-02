import { prisma } from '../src/config/prisma.js';

async function main() {
  const pd = process.argv[2] ?? '48552';
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: {
      id_pedido: { contains: pd },
      usuario: 'master',
    },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    take: 20,
  });
  for (const r of rows) {
    console.log(
      `#${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} — ${r.motivo}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
