/**
 * Coloca uma coleta existente como "mais de 72h sem movimentação" para testar
 * o bloqueio de nova coleta e o fluxo "Dar ciência".
 *
 * Uso: npx tsx scripts/coleta-teste-72h.ts [id]
 * Sem id: usa a primeira coleta em "Em cotação" ou "Em Aprovação".
 * Com id: atualiza a coleta com esse id (se existir e estiver em cotação/aprovação).
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const HORAS_ATRAS = 73;

async function main() {
  const idArg = process.argv[2];
  const dataLimite = new Date(Date.now() - HORAS_ATRAS * 60 * 60 * 1000);

  let coleta: { id: number; status: string | null; usuarioCriacao: string | null } | null = null;

  if (idArg) {
    const id = parseInt(idArg, 10);
    if (!Number.isFinite(id)) {
      console.error('ID inválido. Uso: npx tsx scripts/coleta-teste-72h.ts [id]');
      process.exit(1);
    }
    coleta = await prisma.coletaPrecos.findFirst({
      where: {
        id,
        status: { in: ['Em cotação', 'Em Aprovação'] },
      },
      select: { id: true, status: true, usuarioCriacao: true },
    });
    if (!coleta) {
      console.error('Coleta #' + id + ' não encontrada ou não está em "Em cotação" / "Em Aprovação".');
      process.exit(1);
    }
  } else {
    coleta = await prisma.coletaPrecos.findFirst({
      where: { status: { in: ['Em cotação', 'Em Aprovação'] } },
      orderBy: { id: 'asc' },
      select: { id: true, status: true, usuarioCriacao: true },
    });
    if (!coleta) {
      console.error('Nenhuma coleta em "Em cotação" ou "Em Aprovação". Crie uma coleta pela aplicação e rode o script de novo.');
      process.exit(1);
    }
  }

  // Remove ciência existente para que a coleta volte a bloquear (para teste)
  const delCiencia = await prisma.coletaPrecosCiencia.deleteMany({
    where: { coletaPrecosId: coleta.id },
  });
  if (delCiencia.count > 0) {
    console.log('Ciência anterior removida para esta coleta (para efeito de teste).');
  }

  await prisma.coletaPrecos.update({
    where: { id: coleta.id },
    data: { dataUltimaMovimentacao: dataLimite },
  });

  console.log('Coleta #' + coleta.id + ' atualizada: dataUltimaMovimentacao =', dataLimite.toISOString());
  console.log('Usuário criador:', coleta.usuarioCriacao ?? '—');
  console.log('');
  console.log('Para testar:');
  console.log('1. Entre na aplicação com o usuário "' + (coleta.usuarioCriacao ?? '') + '"');
  console.log('2. Vá em Coletas de Preços — deve aparecer o botão "Dar ciência" na Coleta #' + coleta.id);
  console.log('3. Clique em "Nova coleta de preços" — deve abrir o popup de bloqueio em vez do modal de criação');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
