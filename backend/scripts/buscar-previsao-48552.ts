import { prisma } from '../src/config/prisma.js';

function chavePedidoItem(id: string): string {
  const parts = String(id ?? '').trim().split('-');
  if (parts.length >= 3) {
    const pedido = parts[parts.length - 2]!.trim();
    const itemStr = parts[parts.length - 1]!.trim();
    const numItem = parseInt(itemStr, 10);
    const itemCanonico = Number.isNaN(numItem) ? itemStr : String(numItem);
    return `${pedido}-${itemCanonico}`;
  }
  return String(id ?? '').trim();
}

async function main() {
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({ orderBy: [{ data_ajuste: 'desc' }] });
  for (const prev of ['2026-06-19', '2026-06-18', '2026-07-18']) {
    console.log(`\n=== previsao ${prev} ===`);
    for (const r of rows) {
      if (!chavePedidoItem(r.id_pedido).startsWith('48552-')) continue;
      if (r.previsao_nova.toISOString().slice(0, 10) !== prev) continue;
      console.log(`#${r.id} ${r.id_pedido} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`);
    }
  }
  // item 3941 for PA 10465.8?
  console.log('\n=== canon 48552-3941 ===');
  for (const r of rows) {
    if (chavePedidoItem(r.id_pedido) !== '48552-3941') continue;
    console.log(`#${r.id} ...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
