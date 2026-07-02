/**
 * Remove todos os registros das tabelas de Coleta de Preços (aba Compras) no banco da aplicação.
 * Reinicia os IDs (próxima coleta será id 1).
 * Ordem: tabelas filhas primeiro, depois coleta_precos. Nomus não é alterado.
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const TABLES = ['coleta_precos_cotacao', 'coleta_precos_registro', 'coleta_precos_item', 'coleta_precos'] as const;

async function main() {
  const delCotacao = await prisma.coletaPrecosCotacao.deleteMany({});
  const delRegistros = await prisma.coletaPrecosRegistro.deleteMany({});
  const delItens = await prisma.coletaPrecosItem.deleteMany({});
  const delColetas = await prisma.coletaPrecos.deleteMany({});

  console.log('Removidos:', delCotacao.count, 'cotações,', delRegistros.count, 'registros,', delItens.count, 'itens,', delColetas.count, 'coletas.');

  const url = process.env.DB_URL ?? '';
  if (url.startsWith('file:') || url.includes('sqlite')) {
    for (const table of TABLES) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM sqlite_sequence WHERE name = ?`,
        table
      );
    }
    console.log('IDs reiniciados (sqlite_sequence). Próxima coleta terá id 1.');
  } else if (url.includes('mysql')) {
    for (const table of TABLES) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }
    console.log('AUTO_INCREMENT reiniciado. Próxima coleta terá id 1.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
