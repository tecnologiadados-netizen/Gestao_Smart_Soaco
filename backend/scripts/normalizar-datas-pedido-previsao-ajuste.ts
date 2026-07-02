/**
 * Normaliza as colunas previsao_nova e data_ajuste da tabela pedido_previsao_ajuste
 * para formato de data/datetime correto, sem perder dados.
 *
 * Uso: na pasta backend: npm run fix:datas-ajuste
 *      ou: npx tsx scripts/normalizar-datas-pedido-previsao-ajuste.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RowRaw = { id: number; previsao_nova: unknown; data_ajuste: unknown };

/** Converte valor vindo do SQLite (número ms, string ou Date) para Date. Aceita timestamp ms, ISO, dd/MM/yyyy, dd-MM-yyyy. */
function parseToDate(val: unknown): Date | null {
  if (val == null) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  // Timestamp em milissegundos (número ou string só com dígitos)
  if (typeof val === 'number' && Number.isFinite(val)) {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const d = new Date(Number(s));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // ISO (com ou sem hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (iso) {
    const y = parseInt(iso[1]!, 10);
    const m = parseInt(iso[2]!, 10) - 1;
    const d = parseInt(iso[3]!, 10);
    const h = iso[4] != null ? parseInt(iso[4], 10) : 0;
    const min = iso[5] != null ? parseInt(iso[5], 10) : 0;
    const sec = iso[6] != null ? parseInt(iso[6], 10) : 0;
    const date = new Date(y, m, d, h, min, sec);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // dd/MM/yyyy ou dd-MM-yyyy (com ou sem hora)
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):?(\d{2})?:?(\d{2})?)?/);
  if (br) {
    const d = parseInt(br[1]!, 10);
    const m = parseInt(br[2]!, 10) - 1;
    const y = parseInt(br[3]!, 10);
    const h = br[4] != null ? parseInt(br[4], 10) : 0;
    const min = br[5] != null ? parseInt(br[5], 10) : 0;
    const sec = br[6] != null ? parseInt(br[6], 10) : 0;
    const date = new Date(y, m, d, h, min, sec);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Fallback: new Date(s)
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** previsao_nova: só a data (meia-noite local), sem hora. */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function main() {
  console.log('Lendo registros de pedido_previsao_ajuste...');
  const rows = await prisma.$queryRaw<RowRaw[]>`
    SELECT id, previsao_nova, data_ajuste FROM pedido_previsao_ajuste
  `;
  console.log(`Encontrados ${rows.length} registro(s).`);

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const previsaoDate = parseToDate(row.previsao_nova);
    const dataAjusteDate = parseToDate(row.data_ajuste);

    if (previsaoDate == null) {
      console.warn(`[id=${row.id}] previsao_nova inválida ou vazia: ${row.previsao_nova}. Registro ignorado.`);
      errors += 1;
      continue;
    }
    if (dataAjusteDate == null) {
      console.warn(`[id=${row.id}] data_ajuste inválida ou vazia: ${row.data_ajuste}. Usando data atual.`);
    }

    try {
      // Grava em formato ISO para o SQLite armazenar como texto legível (evita que Prisma persista como número ms)
      const isoPrevisao = toDateOnly(previsaoDate).toISOString();
      const isoDataAjuste = (dataAjusteDate ?? new Date()).toISOString();
      await prisma.$executeRaw`
        UPDATE pedido_previsao_ajuste
        SET previsao_nova = ${isoPrevisao}, data_ajuste = ${isoDataAjuste}
        WHERE id = ${row.id}
      `;
      updated += 1;
    } catch (e) {
      console.error(`[id=${row.id}] Erro ao atualizar:`, e);
      errors += 1;
    }
  }

  console.log(`Concluído: ${updated} atualizado(s), ${errors} erro(s)/ignorado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
