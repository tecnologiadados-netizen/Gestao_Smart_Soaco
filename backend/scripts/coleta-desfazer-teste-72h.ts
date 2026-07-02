/**
 * Desfaz o teste de 72h: atualiza coletas do usuário informado (ex.: fernanda)
 * que estão com dataUltimaMovimentacao antiga, colocando dataUltimaMovimentacao = agora.
 *
 * Uso: npx tsx scripts/coleta-desfazer-teste-72h.ts [login]
 * Ex.: npx tsx scripts/coleta-desfazer-teste-72h.ts fernanda
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const HORAS_ATRAS = 72;

async function main() {
  const login = process.argv[2]?.trim() || 'fernanda';
  const limite = new Date(Date.now() - HORAS_ATRAS * 60 * 60 * 1000);

  const coletas = await prisma.coletaPrecos.findMany({
    where: {
      usuarioCriacao: login,
      status: { in: ['Em cotação', 'Em Aprovação'] },
      OR: [
        { dataUltimaMovimentacao: null },
        { dataUltimaMovimentacao: { lt: limite } },
      ],
    },
    select: { id: true, dataUltimaMovimentacao: true },
  });

  const agora = new Date();
  for (const c of coletas) {
    await prisma.coletaPrecos.update({
      where: { id: c.id },
      data: { dataUltimaMovimentacao: agora },
    });
    console.log('Coleta #' + c.id + ': dataUltimaMovimentacao atualizada para', agora.toISOString());
  }

  if (coletas.length === 0) {
    console.log('Nenhuma coleta do usuário "' + login + '" com mais de ' + HORAS_ATRAS + 'h sem movimentação.');
  } else {
    console.log('Total:', coletas.length, 'coleta(s) atualizada(s). Teste desfeito.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
