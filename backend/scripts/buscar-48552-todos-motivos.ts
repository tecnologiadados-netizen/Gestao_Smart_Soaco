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
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({ orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }] });
  const seen = new Set<string>();
  for (const r of rows) {
    const c = chavePedidoItem(r.id_pedido);
    if (!c.startsWith('48552-')) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    console.log(`\n=== canon ${c} (ex: ${r.id_pedido}) ===`);
  }
  const canon = process.argv[2];
  if (canon) {
    console.log(`\n--- histórico canon ${canon} ---`);
    for (const r of rows) {
      if (chavePedidoItem(r.id_pedido) !== canon) continue;
      console.log(
        `#${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
