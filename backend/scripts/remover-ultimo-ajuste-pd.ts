/**
 * Remove ajuste(s) de previsão de um PD.
 * Uso:
 *   npx tsx scripts/remover-ultimo-ajuste-pd.ts 48552              — lista ajustes
 *   npx tsx scripts/remover-ultimo-ajuste-pd.ts 48552 --id 12345     — remove por id
 *   npx tsx scripts/remover-ultimo-ajuste-pd.ts 48552 --ultimo       — remove o mais recente (global)
 *   npx tsx scripts/remover-ultimo-ajuste-pd.ts 48552 --motivo "Reagendamento"
 */
import { prisma } from '../src/config/prisma.js';
import { invalidatePedidosCache } from '../src/data/pedidosRepository.js';

function pdDigits(idPedido: string): string {
  const parts = String(idPedido).trim().split('-');
  const pd = parts.length >= 2 ? parts[parts.length - 2]! : parts[0] ?? '';
  return pd.replace(/\D/g, '') || pd;
}

async function main() {
  const args = process.argv.slice(2);
  const pdAlvo = String(args.find((a) => !a.startsWith('--')) ?? '48552').replace(/\D/g, '') || '48552';
  const idArg = args.find((a) => a.startsWith('--id='))?.slice(5) ?? args[args.indexOf('--id') + 1];
  const motivoArg = args.find((a) => a.startsWith('--motivo='))?.slice(9) ?? args[args.indexOf('--motivo') + 1];
  const flagUltimo = args.includes('--ultimo');

  const todos = await prisma.pedidoPrevisaoAjuste.findMany({
    orderBy: [{ data_ajuste: 'desc' }, { id: 'desc' }],
  });
  const doPd = todos.filter((r) => pdDigits(r.id_pedido) === pdAlvo);

  if (doPd.length === 0) {
    console.log(`Nenhum ajuste encontrado para PD ${pdAlvo}.`);
    return;
  }

  console.log(`Ajustes PD ${pdAlvo} (${doPd.length}):`);
  for (const r of doPd) {
    console.log(
      `  #${r.id} ${r.id_pedido} rota=${r.rota ?? 'base'} prev=${r.previsao_nova.toISOString().slice(0, 10)} conf=${r.previsao_confiavel} ${r.data_ajuste.toISOString()} ${r.usuario} — ${r.motivo}`
    );
  }

  if (!idArg && !motivoArg && !flagUltimo) {
    console.log('\nInforme --id <n> ou --motivo "texto" ou --ultimo para remover.');
    return;
  }

  let alvo = doPd[0];
  if (idArg) {
    const id = parseInt(idArg, 10);
    alvo = doPd.find((r) => r.id === id);
    if (!alvo) {
      console.error(`Id ${idArg} não encontrado entre os ajustes do PD ${pdAlvo}.`);
      process.exit(1);
    }
  } else if (motivoArg) {
    const m = motivoArg.toLowerCase();
    alvo = doPd.find((r) => String(r.motivo).toLowerCase().includes(m));
    if (!alvo) {
      console.error(`Nenhum ajuste com motivo contendo "${motivoArg}".`);
      process.exit(1);
    }
  } else if (flagUltimo) {
    alvo = doPd[0];
  }

  if (!alvo) return;

  console.log('\nRemovendo:', {
    id: alvo.id,
    id_pedido: alvo.id_pedido,
    rota: alvo.rota,
    previsao_nova: alvo.previsao_nova,
    motivo: alvo.motivo,
    previsao_confiavel: alvo.previsao_confiavel,
    data_ajuste: alvo.data_ajuste,
    usuario: alvo.usuario,
  });
  await prisma.pedidoPrevisaoAjuste.delete({ where: { id: alvo.id } });
  invalidatePedidosCache();
  console.log(`OK — removido registro #${alvo.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
