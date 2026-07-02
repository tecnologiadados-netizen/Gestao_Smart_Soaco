const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info(sycro_order_order)');
  const has = cols.some((c) => c.name === 'aguarda_resposta_destino_time');
  if (!has) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE sycro_order_order ADD COLUMN aguarda_resposta_destino_time TEXT'
    );
    console.log('Column aguarda_resposta_destino_time added.');
  } else {
    console.log('Column already exists.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
