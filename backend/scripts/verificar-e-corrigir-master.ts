/**
 * Verifica se o usuário master existe e se a senha "123" confere.
 * Se não conferir, redefine a senha para "123".
 * Execute na pasta backend: npx tsx scripts/verificar-e-corrigir-master.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const usuario = await prisma.usuario.findUnique({ where: { login: 'master' } });
  if (!usuario) {
    console.log('Usuário master NÃO existe no banco. Execute: npx prisma db seed');
    process.exit(1);
  }
  console.log('Usuário master encontrado (id=%s)', usuario.id);
  const senhaOk = await bcrypt.compare('123', usuario.senhaHash);
  if (senhaOk) {
    console.log('Senha "123" está CORRETA. O login deveria funcionar.');
    return;
  }
  console.log('Senha no banco NÃO confere com "123". Redefinindo senha...');
  const novoHash = await bcrypt.hash('123', 10);
  await prisma.usuario.update({
    where: { login: 'master' },
    data: { senhaHash: novoHash },
  });
  console.log('Senha do master redefinida para "123". Tente fazer login novamente.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
