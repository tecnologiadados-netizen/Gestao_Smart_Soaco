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
  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  const canonAlvo = '48552-3941'; // tentativa PA 10465.8 -> item 3941?
  const desde = new Date('2026-05-01');
  for (const r of rows) {
    if (r.data_ajuste < desde) continue;
    const c = chavePedidoItem(r.id_pedido);
    const pd = chavePedidoItem(r.id_pedido).split('-')[0];
    if (pd !== '48552' && !c.startsWith('48552-')) continue;
    console.log(
      `#${r.id} ${r.id_pedido} canon=${c} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
