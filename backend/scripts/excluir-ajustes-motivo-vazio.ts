/**
 * Exclui da tabela pedido_previsao_ajuste os registros com motivo vazio, em branco ou sem conteúdo.
 * Uso: na pasta backend: npx tsx scripts/excluir-ajustes-motivo-vazio.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Contar antes
  const totalAntes = await prisma.pedidoPrevisaoAjuste.count();
  const comMotivoVazio = await prisma.$queryRaw<
    { count: number }[]
  >`SELECT COUNT(*) as count FROM pedido_previsao_ajuste WHERE motivo IS NULL OR trim(motivo) = ''`;
  const qtd = Number(comMotivoVazio[0]?.count ?? 0);

  if (qtd === 0) {
    console.log('Nenhum registro com motivo vazio encontrado.');
    await prisma.$disconnect();
    return;
  }

  // Excluir
  const result = await prisma.$executeRaw`
    DELETE FROM pedido_previsao_ajuste WHERE motivo IS NULL OR trim(motivo) = ''
  `;
  const totalDepois = await prisma.pedidoPrevisaoAjuste.count();

  console.log(`Registros excluídos (motivo vazio/blank): ${result}`);
  console.log(`Total antes: ${totalAntes}, depois: ${totalDepois}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
