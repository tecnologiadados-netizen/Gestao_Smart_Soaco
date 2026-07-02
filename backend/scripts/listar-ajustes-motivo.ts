import { prisma } from '../src/config/prisma.js';

async function main() {
  const termo = process.argv[2] ?? 'Reagendamento';
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { motivo: { contains: termo } },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
    take: 30,
  });
  for (const r of rows) {
    console.log(
      `#${r.id} ${r.id_pedido} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
