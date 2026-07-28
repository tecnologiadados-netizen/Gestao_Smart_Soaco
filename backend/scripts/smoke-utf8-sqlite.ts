/**
 * Smoke UTF-8: round-trip Prisma + amostra de status de coleta.
 * Uso: cd backend && npx tsx scripts/smoke-utf8-sqlite.ts
 * Exit 1 se falhar.
 */
import { prisma } from '../src/config/prisma.js';

async function main() {
  const probe = `Probe UTF-8: programação ação Gôndolas Em cotação — ${Date.now()}`;
  const row = await prisma.motivoSugestao.upsert({
    where: { descricao: probe },
    create: { descricao: probe },
    update: {},
  });
  const lido = await prisma.motivoSugestao.findUnique({ where: { id: row.id } });
  await prisma.motivoSugestao.delete({ where: { id: row.id } });

  if (!lido || lido.descricao !== probe || lido.descricao.includes('?')) {
    console.error('FAIL: round-trip UTF-8 no SQLite corrompeu a string');
    process.exit(1);
  }
  console.log('OK: round-trip UTF-8 Prisma→SQLite');

  const statusRuim = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*) as c FROM coleta_precos WHERE status LIKE '%?%'`
  );
  const n = Number(statusRuim[0]?.c ?? 0);
  if (n > 0) {
    console.error(`FAIL: coleta_precos.status ainda tem ${n} linha(s) com "?"`);
    process.exit(1);
  }
  console.log('OK: coleta_precos.status sem "?"');

  const ddl = await prisma.$queryRawUnsafe<Array<{ sql: string }>>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='coleta_precos'`
  );
  if ((ddl[0]?.sql ?? '').includes('????')) {
    console.error('FAIL: DEFAULT de coleta_precos ainda corrompido no DDL');
    process.exit(1);
  }
  console.log('OK: DDL coleta_precos sem "????"');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
