import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ai_provider_settings','assistente_conversa','assistente_mensagem')`
  );
  console.log('tables:', rows);

  if (rows.length < 3) {
    console.log('Applying CREATE TABLE IF NOT EXISTS…');
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "ai_provider_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "api_key_encrypted" TEXT NOT NULL,
    "last_tested_at" DATETIME,
    "lastError" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
)`);
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "assistente_conversa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT 'Nova conversa',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assistente_conversa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "assistente_mensagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversa_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistente_mensagem_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "assistente_conversa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "assistente_conversa_usuario_id_updated_at_idx" ON "assistente_conversa"("usuario_id", "updated_at")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "assistente_mensagem_conversa_id_created_at_idx" ON "assistente_mensagem"("conversa_id", "created_at")`
    );
    // register migration if missing
    try {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count") VALUES ('amigaco-manual','manual',datetime('now'),'20260910180000_assistente_amigaco',NULL,NULL,datetime('now'),1)`
      );
    } catch (e) {
      console.warn('migration registry skip:', (e as Error).message);
    }
    console.log('done');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
