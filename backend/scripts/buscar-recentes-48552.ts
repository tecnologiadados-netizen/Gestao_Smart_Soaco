import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { id_pedido: { contains: '48552' } },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  console.log('Total rows id contains 48552:', rows.length);
  for (const r of rows.slice(0, 30)) {
    console.log(
      `#${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
