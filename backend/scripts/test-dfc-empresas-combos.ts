/**
 * Valida filtro empresa: cada combinação deve trazer linhas Nomus e Shop9 quando houver dado.
 * Uso: npx tsx scripts/test-dfc-empresas-combos.ts
 */
import 'dotenv/config';
import { queryDfcAgendamentosEfetivos } from '../src/data/dfcAgendamentoRepository.js';
import { queryDfcReceitasAgrupado } from '../src/data/dfcReceitasRepository.js';
import { queryDfcShop9RetroAgregado, invalidarCacheShop9 } from '../src/data/dfcShop9Repository.js';
import { isShop9Enabled } from '../src/config/shop9Db.js';

const PERIODO = {
  dataBaixaInicio: '2026-01-01',
  dataBaixaFim: '2026-01-31',
  granularidade: 'mes' as const,
};

const COMBOS: number[][] = [
  [1],
  [2],
  [3],
  [4],
  [1, 2],
  [3, 4],
  [1, 2, 3, 4],
];

async function main() {
  if (!isShop9Enabled()) {
    console.error('Shop9 não habilitado (SHOP9_DB_*).');
    process.exit(1);
  }
  invalidarCacheShop9();

  console.log('Período:', PERIODO.dataBaixaInicio, '→', PERIODO.dataBaixaFim);
  console.log('idEmpresas | Nomus P | Nomus R | Shop9 | total merged');
  console.log('-----------|---------|---------|-------|---------------');

  for (const idEmpresas of COMBOS) {
    const params = { ...PERIODO, idEmpresas };
    const [pg, rec, s9] = await Promise.all([
      queryDfcAgendamentosEfetivos(params),
      queryDfcReceitasAgrupado(params),
      queryDfcShop9RetroAgregado(params),
    ]);
    const nPg = pg.linhas.length;
    const nRec = rec.linhas.length;
    const nS9 = s9.linhas.length;
    const total = nPg + nRec + nS9;
    const label = JSON.stringify(idEmpresas);
    console.log(
      `${label.padEnd(10)} | ${String(nPg).padStart(7)} | ${String(nRec).padStart(7)} | ${String(nS9).padStart(5)} | ${total}`
    );
    if (s9.erro) console.log('  Shop9 erro:', s9.erro);
    if (pg.erro) console.log('  Nomus P erro:', pg.erro);
    if (rec.erro) console.log('  Nomus R erro:', rec.erro);
  }

  const [pgAll, recAll, s9All] = await Promise.all([
    queryDfcAgendamentosEfetivos({ ...PERIODO, idEmpresas: [1, 2, 3, 4] }),
    queryDfcReceitasAgrupado({ ...PERIODO, idEmpresas: [1, 2, 3, 4] }),
    queryDfcShop9RetroAgregado({ ...PERIODO, idEmpresas: [1, 2, 3, 4] }),
  ]);
  const sum = (ls: { valor: number }[]) => ls.reduce((a, l) => a + l.valor, 0);
  const v111 =
    [...(s9All.linhas ?? []), ...(recAll.linhas ?? [])]
      .filter((l) => l.idContaFinanceiro === 2 && l.periodo === '2026-01')
      .reduce((a, l) => a + l.valor, 0) +
    0;
  console.log('\nJan/2026 conta 2 (1.1.1) Shop9+Nomus rec (emp 1-4):', v111.toFixed(2));
  console.log('Nomus P jan (1-4):', sum(pgAll.linhas).toFixed(2));

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
