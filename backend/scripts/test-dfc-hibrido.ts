/**
 * Valida agregação híbrida Shop9 + Nomus (receitas).
 * Uso: npx tsx scripts/test-dfc-hibrido.ts
 */
import 'dotenv/config';
import { queryDfcAgendamentosEfetivos } from '../src/data/dfcAgendamentoRepository.js';
import { queryDfcReceitasAgrupado, queryDfcReceitasProjecao } from '../src/data/dfcReceitasRepository.js';
import { queryDfcShop9RetroAgregado, queryDfcShop9ProjecaoAgregado } from '../src/data/dfcShop9Repository.js';
import { mergeDfcAgregadoLinhas } from '../src/data/dfcLancamentoLpRepository.js';

async function main() {
  const retro = {
    dataBaixaInicio: '2026-01-01',
    dataBaixaFim: '2026-05-20',
    granularidade: 'mes' as const,
    idEmpresas: [1, 2],
  };
  const proj = {
    dataVencimentoInicio: '2026-05-21',
    dataVencimentoFim: '2026-12-31',
    granularidade: 'mes' as const,
    idEmpresas: [1, 2],
  };

  const [pg, rec, s9Retro, s9Proj, recProj] = await Promise.all([
    queryDfcAgendamentosEfetivos(retro),
    queryDfcReceitasAgrupado(retro),
    queryDfcShop9RetroAgregado(retro),
    queryDfcShop9ProjecaoAgregado(proj),
    queryDfcReceitasProjecao(proj),
  ]);

  const mergedRetro = mergeDfcAgregadoLinhas(
    mergeDfcAgregadoLinhas(s9Retro.linhas, pg.linhas),
    rec.linhas
  );
  const mergedProj = mergeDfcAgregadoLinhas(
    mergeDfcAgregadoLinhas(s9Proj.linhas, []),
    recProj.linhas
  );

  const sum = (ls: { idContaFinanceiro: number; valor: number }[], id: number) =>
    ls.filter((l) => l.idContaFinanceiro === id).reduce((a, l) => a + l.valor, 0);

  console.log('--- Retrospectivo 2026-01..05 (empresas 1,2) ---');
  console.log('Nomus pagamentos (P):', pg.linhas.length, pg.erro ?? 'ok', 'total', pg.linhas.reduce((a, l) => a + l.valor, 0).toFixed(2));
  console.log('Nomus receitas:', rec.linhas.length, rec.erro ?? 'ok');
  for (const id of [2, 3, 4]) console.log(`  Nomus id ${id}:`, sum(rec.linhas, id).toFixed(2));
  console.log('Shop9 retro:', s9Retro.linhas.length, s9Retro.erro ?? 'ok');
  for (const id of [2, 3, 4]) console.log(`  Shop9 id ${id}:`, sum(s9Retro.linhas, id).toFixed(2));
  console.log('Mesclado (Shop9 + Nomus, soma por conta/período):');
  for (const id of [2, 3, 4]) console.log(`  Merged id ${id}:`, sum(mergedRetro, id).toFixed(2));

  console.log('\n--- Projeção futura ---');
  console.log('Shop9 proj:', s9Proj.linhas.length);
  console.log('Nomus rec proj:', recProj.linhas.length, recProj.erro ?? 'ok');
  for (const id of [2, 3, 4]) console.log(`  Merged proj id ${id}:`, sum(mergedProj, id).toFixed(2));

  const { rows: raw } = await import('../src/data/dfcShop9Repository.js').then((m) =>
    m.carregarLinhasShop9Financeiro(true)
  );
  const { formatYmd } = await import('../src/data/dfcShop9Repository.js');
  const { shop9CodigoEhReceitaVendasProduto } = await import('../src/data/dfcShop9PlanoContasMap.js');
  const { linhaShop9MatchesNomusEmpresa } = await import('../src/data/dfcShop9Empresa.js');
  const match12 = (r: (typeof raw)[0]) =>
    linhaShop9MatchesNomusEmpresa(r, 1) || linhaShop9MatchesNomusEmpresa(r, 2);
  let rBaixa = 0;
  let rProd = 0;
  let valProd = 0;
  let rAberto = 0;
  for (const r of raw) {
    if (!match12(r)) continue;
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    if (!shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)) continue;
    const baixa = formatYmd(r.dataBaixa);
    if (baixa && baixa >= '2026-01-01' && baixa <= '2026-05-20') {
      rBaixa++;
      valProd += r.valorBaixado;
    }
    if (!baixa) rAberto++;
  }
  console.log('\n--- Diagnóstico Shop9 R vendas produto (emp 1+2) ---');
  console.log('Com baixa em 2026-01..05:', rBaixa, 'valor', valProd.toFixed(2));
  console.log('Em aberto (sem baixa):', rAberto);

  let rAll = 0;
  let valAll = 0;
  const codigos = new Map<number, number>();
  for (const r of raw) {
    if (!match12(r)) continue;
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-05-20') continue;
    rAll++;
    valAll += r.valorBaixado;
    const c = r.idPlanoContas ?? 0;
    codigos.set(c, (codigos.get(c) ?? 0) + r.valorBaixado);
  }
  console.log('Qualquer R com baixa 2026:', rAll, 'valor', valAll.toFixed(2));
  console.log('Top códigos plano:', [...codigos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));

  let rGlobal = 0;
  const empresasR = new Map<string, number>();
  for (const r of raw) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-05-20') continue;
    rGlobal++;
    const e = r.empresa ?? '(vazio)';
    empresasR.set(e, (empresasR.get(e) ?? 0) + r.valorBaixado);
  }
  console.log('\nR global 2026 (todas empresas Shop9):', rGlobal);
  console.log('Por empresa:', [...empresasR.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
