import { PrismaClient } from '@prisma/client';
import { listarPedidos } from './src/data/pedidosRepository.ts';

const prisma = new PrismaClient();

function getField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function normalizePd(s: string) {
  const t = String(s ?? '').trim();
  return t.replace(/^0+/, '') || t;
}

async function main() {
  const cards = await prisma.sycroOrderOrder.findMany({
    where: { status: { not: 'FINISHED' } },
    select: { id: true, order_number: true, status: true },
  });
  console.log('cards_abertos', cards.length);

  const { data, erroConexao } = await listarPedidos({});
  if (erroConexao) console.error('erro', erroConexao);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log('gerenciador_linhas_total', rows.length);

  const pdSet = new Set(cards.map((c) => normalizePd(c.order_number)));
  const vendedorPorPd = new Map<string, string>();
  for (const r of rows) {
    const pd = normalizePd(String(r['PD'] ?? ''));
    if (!pd || !pdSet.has(pd) || vendedorPorPd.has(pd)) continue;
    const vend = getField(r, ['Vendedor/Representante', 'vendedor/representante', 'Vendedor', 'vendedor']);
    if (vend) vendedorPorPd.set(pd, vend);
  }

  // Fallback: PDs sem match na carga geral — busca individual
  const missing = [...pdSet].filter((pd) => !vendedorPorPd.has(pd));
  console.log('pds_sem_match_na_carga', missing.length);
  for (const pd of missing) {
    const { data: d2 } = await listarPedidos({ pd });
    const rows2 = (d2 ?? []) as Array<Record<string, unknown>>;
    for (const r of rows2) {
      const vend = getField(r, ['Vendedor/Representante', 'vendedor/representante', 'Vendedor', 'vendedor']);
      if (vend) {
        vendedorPorPd.set(pd, vend);
        break;
      }
    }
    // também tenta encerrados? skip for now
  }

  const counts = new Map<string, { cards: number; pds: Set<string> }>();
  for (const c of cards) {
    const pd = normalizePd(c.order_number);
    const vend = vendedorPorPd.get(pd) || '(sem vendedor)';
    let e = counts.get(vend);
    if (!e) {
      e = { cards: 0, pds: new Set() };
      counts.set(vend, e);
    }
    e.cards++;
    e.pds.add(pd);
  }

  const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  console.log('\n=== VENDEDORES — CARDS ABERTOS ===');
  for (const [nome, info] of sorted) {
    console.log(`${nome} | cards=${info.cards} | pds=${info.pds.size}`);
  }
  console.log('\nNOMES_SOMENTE');
  for (const [nome] of sorted) {
    if (nome !== '(sem vendedor)') console.log(nome);
  }
  console.log('\ntotal_vendedores', sorted.filter(([n]) => n !== '(sem vendedor)').length);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
