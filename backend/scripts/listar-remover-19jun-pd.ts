/**
 * Lista/remove ajustes com previsao_nova = 19/06/2026 para itens do PD informado.
 * Uso: npx tsx scripts/listar-remover-19jun-pd.ts 48552
 *      npx tsx scripts/listar-remover-19jun-pd.ts 48552 --aplicar
 */
import { prisma } from '../src/config/prisma.js';
import { invalidatePedidosCache } from '../src/data/pedidosRepository.js';

const PREVISAO_ALVO = '2026-06-19';

function pdDoIdPedido(idPedido: string): string {
  const parts = String(idPedido ?? '').trim().split('-');
  if (parts.length >= 2) return parts[parts.length - 2]!.replace(/\D/g, '') || parts[parts.length - 2]!;
  return '';
}

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
  const args = process.argv.slice(2);
  const pdAlvo = (args.find((a) => !a.startsWith('--')) ?? '48552').replace(/\D/g, '');
  const aplicar = args.includes('--aplicar');

  const todos = await prisma.pedidoPrevisaoAjuste.findMany({
    where: {
      previsao_nova: {
        gte: new Date(`${PREVISAO_ALVO}T00:00:00.000Z`),
        lte: new Date(`${PREVISAO_ALVO}T23:59:59.999Z`),
      },
    },
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });

  const doPd = todos.filter((r) => pdDoIdPedido(r.id_pedido) === pdAlvo);
  const doPdContains = todos.filter((r) => r.id_pedido.includes(`-${pdAlvo}-`));

  console.log(`Global previsão ${PREVISAO_ALVO}: ${todos.length} registro(s)`);
  for (const r of todos) {
    console.log(`  #${r.id} pd=${pdDoIdPedido(r.id_pedido)} ${r.id_pedido} — ${r.motivo}`);
  }

  console.log(`\nAjustes previsão ${PREVISAO_ALVO} — PD ${pdAlvo} (segmento): ${doPd.length}`);
  for (const r of doPd) {
    console.log(
      `  #${r.id} ${r.id_pedido} canon=${chavePedidoItem(r.id_pedido)} rota=${r.rota ?? 'base'} ${r.data_ajuste.toISOString()} ${r.motivo} user=${r.usuario} conf=${r.previsao_confiavel}`
    );
  }

  // Também listar se houver id_pedido contendo -48552- mas PD extraído diferente (sanity)
  const contemPd = todos.filter((r) => r.id_pedido.includes(`-${pdAlvo}-`));
  if (contemPd.length !== doPd.length) {
    console.log('\nPor contains -48552-:', contemPd.length);
    for (const r of contemPd) {
      if (!doPd.some((x) => x.id === r.id)) {
        console.log(`  extra #${r.id} ${r.id_pedido} pdExtraido=${pdDoIdPedido(r.id_pedido)}`);
      }
    }
  }

  if (!aplicar) {
    console.log('\nDry-run. Use --aplicar para remover.');
    return;
  }

  if (doPd.length === 0) {
    console.log('Nada a remover.');
    return;
  }

  const ids = doPd.map((r) => r.id);
  const deleted = await prisma.pedidoPrevisaoAjuste.deleteMany({ where: { id: { in: ids } } });
  invalidatePedidosCache();
  console.log(`\nRemovidos ${deleted.count} registro(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
