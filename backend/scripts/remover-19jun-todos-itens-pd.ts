/**
 * Remove ajustes com previsao_nova = 19/06/2026 para todos os itens cujo campo PD (Nomus) = pedido informado.
 * Uso: npx tsx scripts/remover-19jun-todos-itens-pd.ts 48552
 *      npx tsx scripts/remover-19jun-todos-itens-pd.ts 48552 --aplicar
 */
import { prisma } from '../src/config/prisma.js';
import {
  invalidatePedidosCache,
  listarPedidos,
  listarHistoricoAjustes,
} from '../src/data/pedidosRepository.js';

const PREVISAO_ALVO = '2026-06-19';

function normalizePdDigits(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function rowMatchesPd(row: Record<string, unknown>, pdAlvo: string): boolean {
  const rowPd = String(row['PD'] ?? row['pd'] ?? '').trim();
  return normalizePdDigits(rowPd) === normalizePdDigits(pdAlvo);
}

async function main() {
  const args = process.argv.slice(2);
  const pdAlvo = (args.find((a) => !a.startsWith('--')) ?? '48552').replace(/\D/g, '');
  const aplicar = args.includes('--aplicar');

  const { data: pedidos, erroConexao } = await listarPedidos({});
  if (erroConexao) {
    console.error('Erro ao listar pedidos Nomus:', erroConexao);
    process.exit(1);
  }

  const linhasPd = pedidos.filter((r) => rowMatchesPd(r as Record<string, unknown>, pdAlvo));
  const idsChave = [...new Set(linhasPd.map((r) => String(r.id_pedido ?? '').trim()).filter(Boolean))];
  console.log(`Linhas PD ${pdAlvo}: ${linhasPd.length}, idChave únicos: ${idsChave.length}`);

  const idsRemover = new Set<number>();

  for (const idChave of idsChave) {
    const hist = await listarHistoricoAjustes(idChave);
    const com19 = hist.filter((h) => h.previsao_nova.toISOString().slice(0, 10) === PREVISAO_ALVO);
    if (com19.length === 0) continue;

    // Apenas o(s) do dia 19/06 — se última edição for essa data, remove todas entradas com essa previsão
    // (normalmente 1 por item: Reagendamento da importação)
    for (const h of com19) {
      idsRemover.add(h.id);
    }
    const top = hist[0];
    console.log(
      `  ${idChave}: ${com19.length} entrada(s) 19/06` +
        (top && com19.some((x) => x.id === top.id) ? ' (inclui última)' : '') +
        ` → #${com19.map((x) => x.id).join(', #')}`
    );
  }

  const rows = await prisma.pedidoPrevisaoAjuste.findMany({
    where: { id: { in: [...idsRemover] } },
    orderBy: { id: 'asc' },
  });

  console.log(`\nTotal a remover: ${rows.length}`);
  for (const r of rows) {
    console.log(`  #${r.id} ${r.id_pedido} ${r.motivo} conf=${r.previsao_confiavel}`);
  }

  if (!aplicar) {
    console.log('\nDry-run. Use --aplicar para remover.');
    return;
  }

  if (rows.length === 0) {
    console.log('Nada a remover.');
    return;
  }

  const deleted = await prisma.pedidoPrevisaoAjuste.deleteMany({
    where: { id: { in: [...idsRemover] } },
  });
  invalidatePedidosCache();
  console.log(`\nRemovidos ${deleted.count} registro(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
