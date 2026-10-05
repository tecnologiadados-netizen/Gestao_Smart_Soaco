import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE } from '../src/services/doubleCheckInConferenciaPeriodo.js';

async function main(): Promise<void> {
  const legadas = await prisma.doubleCheckInConferido.findMany({
    where: { conferidoEm: { lt: DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE } },
    select: { idDocumentoEstoque: true },
  });
  const ids = legadas.map((item) => item.idDocumentoEstoque);
  const [decisoes, paginas] =
    ids.length === 0
      ? [0, 0]
      : await Promise.all([
          prisma.doubleCheckInComparativoDecisao.count({
            where: { idDocumentoEstoque: { in: ids } },
          }),
          prisma.doubleCheckInConferenciaPagina.count({
            where: { idDocumentoEstoque: { in: ids } },
          }),
        ]);

  if (decisoes > 0 || paginas > 0) {
    throw new Error(
      `Limpeza bloqueada: ${decisoes} decisão(ões) e ${paginas} página(s) vinculadas às conferências legadas.`
    );
  }

  const removidas =
    ids.length === 0
      ? 0
      : (
          await prisma.doubleCheckInConferido.deleteMany({
            where: { idDocumentoEstoque: { in: ids } },
          })
        ).count;

  console.log(
    JSON.stringify(
      {
        corte: DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE.toISOString(),
        conferenciasLegadasEncontradas: ids.length,
        conferenciasRemovidas: removidas,
        decisoesVinculadas: decisoes,
        paginasVinculadas: paginas,
      },
      null,
      2
    )
  );
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
