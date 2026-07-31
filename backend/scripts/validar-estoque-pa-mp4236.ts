/**
 * Validação: empenho líquido = max(0, bruto − estoque em PA) (MP 4236 / PA 3404).
 * Uso: npx tsx backend/scripts/validar-estoque-pa-mp4236.ts
 */
import 'dotenv/config';
import { getNomusPool, isNomusEnabled } from '../src/config/nomusDb.js';
import { listarEmpenhoRessupPorPedido } from '../src/data/comprasRepository.js';
import { buildEmpenhoRessupDetalheSql } from '../src/data/sqlRegistroColetaPrecos.js';
import {
  resolverFundiveisParesNomus,
  type FundivelParNomus,
} from '../src/data/ressupNaoAlmoxCatalogRepository.js';

const COD_MP = 'MP 4236';
const COD_PA = 'PA 3404';

async function main(): Promise<void> {
  if (!isNomusEnabled()) {
    console.error('NOMUS_DB_URL não configurado — validação ignorada.');
    process.exit(0);
  }
  const pool = getNomusPool();
  if (!pool) {
    console.error('Pool Nomus indisponível.');
    process.exit(1);
  }

  const [prodRows] = (await pool.query(
    `Select id, nome From produto Where nome In (?, ?)`,
    [COD_MP, COD_PA]
  )) as [Record<string, unknown>[], unknown];
  const mp = (prodRows ?? []).find((r) => String(r.nome ?? '').trim() === COD_MP);
  const pa = (prodRows ?? []).find((r) => String(r.nome ?? '').trim() === COD_PA);
  if (!mp || !pa) {
    console.error(`Produto ${COD_MP} ou ${COD_PA} não encontrado.`, prodRows);
    process.exit(1);
  }
  const idMp = Number(mp.id);
  const idPa = Number(pa.id);
  console.log(`${COD_MP} id=${idMp}; ${COD_PA} id=${idPa}`);

  let pares: FundivelParNomus[] = [];
  try {
    pares = await resolverFundiveisParesNomus(pool);
  } catch (e) {
    console.warn('fundiveis:', e instanceof Error ? e.message : e);
  }

  const detalheSql = buildEmpenhoRessupDetalheSql(true, pares);
  const [detRowsRaw] = (await pool.query(detalheSql, [idMp])) as [Record<string, unknown>[], unknown];
  const detRows = Array.isArray(detRowsRaw) ? detRowsRaw : [];
  const linhasPa = detRows.filter((r) => Number(r.idPa) === idPa);
  if (linhasPa.length === 0) {
    console.error(`FALHA: ${COD_PA} não aparece no detalhe de empenho de ${COD_MP}.`);
    process.exit(1);
  }

  const qtdeNec = linhasPa.reduce((s, r) => s + (Number(r.qtdeNecessaria) || 0), 0);
  const estoquePa = Number(linhasPa[0].estoquePa) || 0;
  const contribPa = estoquePa * qtdeNec;
  console.log(`\n${COD_PA}: estoque=${estoquePa}, qtdeNec=${qtdeNec}, contrib=${contribPa}`);

  const { data, erro } = await listarEmpenhoRessupPorPedido(idMp, true);
  if (erro || !data) {
    console.error('Erro listarEmpenhoRessupPorPedido:', erro);
    process.exit(1);
  }

  const paExpl = data.estoquePaExplosao ?? 0;
  const vd = data.vendaDireta ?? 0;
  const liquidoEsperado =
    Math.round((Math.max(0, data.totalBruto - vd - paExpl) + vd) * 100) / 100;

  console.log('\n=== Modal empenho (considerarRequisicoes=true) ===');
  console.log('totalBruto:', data.totalBruto);
  console.log('estoquePaExplosao:', paExpl);
  console.log('vendaDireta:', vd);
  console.log('totalCoberto:', data.totalCoberto);
  console.log('totalLiquido:', data.totalLiquido);
  console.log('liquidoEsperado (max(0,bruto−VD−PA)+VD):', liquidoEsperado);

  let ok = true;

  if (data.estoquePaExplosao == null || !Number.isFinite(data.estoquePaExplosao)) {
    console.error('FALHA: estoquePaExplosao não retornado.');
    ok = false;
  } else if (data.estoquePaExplosao + 1e-6 < contribPa) {
    console.error(
      `FALHA: estoquePaExplosao=${data.estoquePaExplosao} < contribuição ${COD_PA}=${contribPa}`
    );
    ok = false;
  } else {
    console.log(`OK: estoquePaExplosao=${data.estoquePaExplosao} >= contrib ${COD_PA}=${contribPa}`);
  }

  if (Math.abs(data.totalLiquido - liquidoEsperado) > 0.02) {
    console.error(
      `FALHA: totalLiquido=${data.totalLiquido} ≠ esperado ${liquidoEsperado} (bruto−PA).`
    );
    ok = false;
  } else {
    console.log('OK: totalLiquido == max(0, bruto − PA) (+ venda direta).');
  }

  const esperadoCoberto = Math.round((data.totalBruto - data.totalLiquido) * 100) / 100;
  if (Math.abs(data.totalCoberto - esperadoCoberto) > 0.02) {
    console.error('FALHA: totalCoberto inconsistente com bruto−líquido.');
    ok = false;
  } else {
    console.log('OK: totalCoberto == bruto − líquido.');
  }

  // Quando bruto BOM ≥ PA, cobertura ≈ estoque PA (venda direta não é coberta).
  const brutoBom = data.totalBruto - vd;
  if (brutoBom + 1e-9 >= paExpl && Math.abs(data.totalCoberto - paExpl) > 0.05) {
    console.error(
      `FALHA: totalCoberto=${data.totalCoberto} deveria ≈ estoquePaExplosao=${paExpl}`
    );
    ok = false;
  } else if (brutoBom + 1e-9 >= paExpl) {
    console.log('OK: totalCoberto ≈ estoquePaExplosao (bruto BOM ≥ PA).');
  }

  process.exit(ok ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getNomusPool()?.end();
    } catch {
      /* ignore */
    }
  });
