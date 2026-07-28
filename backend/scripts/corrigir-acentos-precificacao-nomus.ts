/**
 * Rehidrata descrições de precificação e cubagem a partir do Nomus (UTF-8) — em lote.
 *
 * Uso:
 *   cd backend && npx tsx scripts/corrigir-acentos-precificacao-nomus.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../src/config/nomusDb.js';

function temInterrogacao(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.includes('?');
}

async function fetchDescricoesNomus(
  pool: NonNullable<ReturnType<typeof getNomusPool>>,
  ids: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const BATCH = 400;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    if (slice.length === 0) continue;
    const placeholders = slice.map(() => '?').join(',');
    const [rows] = await nomusQueryWithRetry<Array<{ id: number; descricao: string }>>(
      pool,
      `SELECT id, descricao FROM produto WHERE id IN (${placeholders})`,
      slice
    );
    for (const r of rows) {
      const d = r.descricao != null ? String(r.descricao) : '';
      if (d && !temInterrogacao(d)) map.set(Number(r.id), d);
    }
  }
  return map;
}

async function bulkUpdateByIdProduto(
  table: string,
  idCol: string,
  descCol: string,
  pairs: Array<{ idProduto: number; descricao: string }>
): Promise<number> {
  if (pairs.length === 0) return 0;
  await prisma.$executeRawUnsafe(`CREATE TEMP TABLE IF NOT EXISTS _fix_desc (idProduto INTEGER PRIMARY KEY, descricao TEXT)`);
  await prisma.$executeRawUnsafe(`DELETE FROM _fix_desc`);
  const CHUNK = 200;
  let updated = 0;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const slice = pairs.slice(i, i + CHUNK);
    const values = slice.map(() => '(?, ?)').join(',');
    const params = slice.flatMap((p) => [p.idProduto, p.descricao]);
    await prisma.$executeRawUnsafe(`INSERT OR REPLACE INTO _fix_desc (idProduto, descricao) VALUES ${values}`, ...params);
  }
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "${descCol}" = (SELECT d.descricao FROM _fix_desc d WHERE d.idProduto = "${table}"."${idCol}")
     WHERE "${descCol}" LIKE '%?%'
       AND "${idCol}" IN (SELECT idProduto FROM _fix_desc)`
  );
  updated = Number(result);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _fix_desc`);
  return updated;
}

async function main() {
  if (!isNomusEnabled()) {
    console.error('NOMUS_DB_URL não configurado — abortando.');
    process.exit(1);
  }
  const pool = getNomusPool();
  if (!pool) {
    console.error('Pool Nomus indisponível.');
    process.exit(1);
  }

  console.log('Rehidratando precificação/cubagem (lote)...');

  const precifs = await prisma.$queryRawUnsafe<Array<{ idProduto: number }>>(
    `SELECT DISTINCT idProduto FROM precificacao WHERE descricaoProduto LIKE '%?%'`
  );
  const idsPrecif = precifs.map((p) => Number(p.idProduto));
  console.log(`precificacao ids distintos com ?: ${idsPrecif.length}`);
  const descMap = await fetchDescricoesNomus(pool, idsPrecif);
  const pairsPrecif = idsPrecif
    .filter((id) => descMap.has(id))
    .map((id) => ({ idProduto: id, descricao: descMap.get(id)! }));
  const n1 = await bulkUpdateByIdProduto('precificacao', 'idProduto', 'descricaoProduto', pairsPrecif);
  console.log(`precificacao linhas atualizadas=${n1}`);

  const itensPai = await prisma.$queryRawUnsafe<Array<{ idprodutopai: number }>>(
    `SELECT DISTINCT idprodutopai FROM precificacao_item WHERE descricaopai LIKE '%?%' AND idprodutopai IS NOT NULL`
  );
  const itensComp = await prisma.$queryRawUnsafe<Array<{ idcomponente: number }>>(
    `SELECT DISTINCT idcomponente FROM precificacao_item WHERE componente LIKE '%?%' AND idcomponente IS NOT NULL`
  );
  const idsItens = [
    ...new Set([
      ...itensPai.map((r) => Number(r.idprodutopai)),
      ...itensComp.map((r) => Number(r.idcomponente)),
    ]),
  ];
  console.log(`precificacao_item ids distintos com ?: ${idsItens.length}`);
  const descItens = await fetchDescricoesNomus(pool, idsItens);
  for (const [id, d] of descItens) descMap.set(id, d);

  const pairsPai = [...descMap.entries()].map(([idProduto, descricao]) => ({ idProduto, descricao }));
  const nPai = await bulkUpdateByIdProduto('precificacao_item', 'idprodutopai', 'descricaopai', pairsPai);
  const nComp = await bulkUpdateByIdProduto('precificacao_item', 'idcomponente', 'componente', pairsPai);
  console.log(`precificacao_item descricaopai=${nPai}, componente=${nComp}`);

  const cub = await prisma.$queryRawUnsafe<Array<{ idProduto: number }>>(
    `SELECT DISTINCT idProduto FROM cubagem_produto WHERE descricaoProduto LIKE '%?%'`
  );
  const idsCub = cub.map((c) => Number(c.idProduto));
  console.log(`cubagem ids distintos com ?: ${idsCub.length}`);
  const descCub = await fetchDescricoesNomus(pool, idsCub);
  const pairsCub = idsCub
    .filter((id) => descCub.has(id))
    .map((id) => ({ idProduto: id, descricao: descCub.get(id)! }));
  const nCub = await bulkUpdateByIdProduto('cubagem_produto', 'idProduto', 'descricaoProduto', pairsCub);
  console.log(`cubagem atualizados=${nCub}`);

  // Fallback: produtos ausentes no Nomus — fragmentos seguros (GÔNDOLA, AÇO, etc.)
  const FRAGS: Array<[string, string]> = [
    ['CONTINUA????O', 'CONTINUAÇÃO'],
    ['Continua????o', 'Continuação'],
    ['continua????o', 'continuação'],
    ['DIVIS??ES', 'DIVISÕES'],
    ['Divis??es', 'Divisões'],
    ['G??NDOLA', 'GÔNDOLA'],
    ['G??ndola', 'Gôndola'],
    ['G??ndolas', 'Gôndolas'],
    ['A??O', 'AÇO'],
    ['A??o', 'Aço'],
    ['a??o', 'aço'],
  ];
  const cols = [
    { table: 'precificacao', column: 'descricaoProduto' },
    { table: 'precificacao_item', column: 'descricaopai' },
    { table: 'precificacao_item', column: 'componente' },
    { table: 'cubagem_produto', column: 'descricaoProduto' },
  ];
  let fragOps = 0;
  for (const { table, column } of cols) {
    for (const [de, para] of FRAGS) {
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${column}" = REPLACE("${column}", ?, ?) WHERE "${column}" LIKE ?`,
        de,
        para,
        `%${de}%`
      );
      fragOps += Number(n);
    }
  }
  console.log(`fallback fragmentos ops=${fragOps}`);

  const rest = await prisma.$queryRawUnsafe<Array<{ t: string; c: number }>>(
    `SELECT 'precif' as t, COUNT(*) as c FROM precificacao WHERE descricaoProduto LIKE '%?%'
     UNION ALL SELECT 'item_pai', COUNT(*) FROM precificacao_item WHERE descricaopai LIKE '%?%'
     UNION ALL SELECT 'item_comp', COUNT(*) FROM precificacao_item WHERE componente LIKE '%?%'
     UNION ALL SELECT 'cubagem', COUNT(*) FROM cubagem_produto WHERE descricaoProduto LIKE '%?%'`
  );
  console.log('Restantes com ?:', rest);
  console.log('Concluído.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
