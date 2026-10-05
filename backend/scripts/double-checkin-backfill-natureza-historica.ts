import 'dotenv/config';
import { resetNomusPool } from '../src/config/nomusDb.js';
import { prisma } from '../src/config/prisma.js';
import { executarBackfillNaturezaHistorica } from '../src/services/doubleCheckInNaturezaHistorica.js';

const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--simular');

try {
  const resultado = await executarBackfillNaturezaHistorica({ dryRun });
  console.log(
    JSON.stringify(
      {
        modo: dryRun ? 'dry-run' : 'gravacao',
        ...resultado,
      },
      null,
      2
    )
  );
  if (resultado.falhas.length > 0) process.exitCode = 1;
} finally {
  await resetNomusPool();
  await prisma.$disconnect();
}
