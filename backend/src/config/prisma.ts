import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaPragmasOk?: boolean };

const prismaLog: Array<'query' | 'error' | 'warn'> =
  process.env.PRISMA_LOG_QUERIES === 'true'
    ? ['query', 'error', 'warn']
    : process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLog,
  });

/** WAL + busy_timeout reduzem risco de "database disk image is malformed" em SQLite sob carga. */
export async function ensureSqlitePragmas(client: PrismaClient = prisma): Promise<void> {
  if (globalForPrisma.prismaPragmasOk) return;
  try {
    await client.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await client.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
    await client.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
    globalForPrisma.prismaPragmasOk = true;
  } catch (e) {
    console.warn('[prisma] Falha ao aplicar PRAGMAs SQLite:', e instanceof Error ? e.message : e);
  }
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
