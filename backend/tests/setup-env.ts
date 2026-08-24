/**
 * Garante DB_URL antes de qualquer import do Prisma nos testes (CI e local sem .env).
 */
process.env.DB_URL = process.env.DB_URL?.trim() || 'file:./prisma/vitest.db';
