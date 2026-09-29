/**
 * Na subida do servidor, grava na coluna `mes_falta` apenas os meses que ainda
 * não estão no padrão (`abr.` → permanece; `ABRIL` → `abr.`).
 * Não altera outras colunas nem `updated_at`. Texto que não é mês fica intacto.
 */
import { prisma } from '../../config/prisma.js';
import { destinoMesFaltaSeForaDoPadrao } from './normalizarMesFalta.js';

export async function normalizarMesFaltaPersistido(): Promise<number> {
  const linhas = await prisma.$queryRaw<Array<{ mes_falta: string }>>`
    SELECT DISTINCT mes_falta
    FROM rh_faltas_atestados
    WHERE mes_falta IS NOT NULL AND mes_falta != ''
  `;

  let total = 0;
  for (const linha of linhas) {
    const origem = linha.mes_falta;
    const destino = destinoMesFaltaSeForaDoPadrao(origem);
    if (!destino) continue;
    const atualizados = await prisma.$executeRaw`
      UPDATE rh_faltas_atestados
      SET mes_falta = ${destino}
      WHERE mes_falta = ${origem}
    `;
    const n = Number(atualizados);
    if (n > 0) {
      total += n;
      console.log(`[startup] Mês falta: "${origem}" → "${destino}" (${n})`);
    }
  }

  if (total > 0) {
    console.log(`[startup] Mês falta: ${total} registro(s) normalizado(s) na coluna mes_falta.`);
  }
  return total;
}
