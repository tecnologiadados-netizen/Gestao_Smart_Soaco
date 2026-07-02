import { prisma } from '../src/config/prisma.js';

function pdDigits(idPedido: string): string {
  const parts = String(idPedido).trim().split('-');
  const pd = parts.length >= 2 ? parts[parts.length - 2]! : parts[0] ?? '';
  return pd.replace(/\D/g, '') || pd;
}

async function main() {
  const pd = String(process.argv[2] ?? '48552').replace(/\D/g, '');
  const prev = process.argv[3] ?? '2026-06-19';
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  const f = rows.filter((r) => pdDigits(r.id_pedido) === pd && r.previsao_nova.toISOString().slice(0, 10) === prev);
  for (const r of f) {
    console.log(
      `#${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
    );
  }
  console.log(`Total: ${f.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
