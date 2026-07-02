/**
 * Valida receitas Shop9 (conta DFC 2) em jan/2026 — meta ~509.225,14
 * Uso: npx tsx scripts/test-shop9-receitas-jan2026.ts
 */
import 'dotenv/config';
import {
  carregarLinhasShop9Financeiro,
  formatYmd,
  queryDfcShop9RetroAgregado,
  invalidarCacheShop9,
} from '../src/data/dfcShop9Repository.js';
import {
  shop9CodigoEhReceitaVendasProduto,
  DFC_ID_RECEITA_VENDAS_PRODUTO,
} from '../src/data/dfcShop9PlanoContasMap.js';
import { linhaShop9MatchesNomusEmpresa } from '../src/data/dfcShop9Empresa.js';
import { resolverIdContaFinanceiroShop9 } from '../src/data/dfcShop9PlanoContasMap.js';

const META = 509_225.14;
const TOLERANCIA = 0.025;

async function main() {
  invalidarCacheShop9();
  const { rows, erro } = await carregarLinhasShop9Financeiro(true);
  if (erro) console.warn('Aviso carga:', erro);
  console.log('Linhas após dedup:', rows.length);

  let somaJan = 0;
  let linhasJan = 0;
  const ordens = new Set<number>();
  for (const r of rows) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    if (!linhaShop9MatchesNomusEmpresa(r, 1) && !linhaShop9MatchesNomusEmpresa(r, 2)) continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
    const id = resolverIdContaFinanceiroShop9(r.tipoConta, r.idPlanoContas, r.planoContas);
    if (id !== DFC_ID_RECEITA_VENDAS_PRODUTO) continue;
    somaJan += r.valorBaixado;
    linhasJan++;
    ordens.add(r.ordemFinanceira);
  }
  console.log('Jan/2026 emp 1+2 — conta 2 (vendas produto Shop9):');
  console.log('  Linhas:', linhasJan, 'Ordens únicas:', ordens.size);
  console.log('  Soma valorBaixado:', somaJan.toFixed(2));
  console.log('  Meta:', META.toFixed(2));
  console.log('  Diff %:', (((somaJan - META) / META) * 100).toFixed(2) + '%');

  const retro = await queryDfcShop9RetroAgregado({
    dataBaixaInicio: '2026-01-01',
    dataBaixaFim: '2026-01-31',
    granularidade: 'mes',
    idEmpresas: [1, 2],
  });
  const jan = retro.linhas.find(
    (l) => l.idContaFinanceiro === DFC_ID_RECEITA_VENDAS_PRODUTO && l.periodo === '2026-01'
  );
  console.log('Agregado API jan/2026 id=2:', jan?.valor.toFixed(2) ?? '0');

  let somaJanAll = 0;
  let linhasJanAll = 0;
  for (const r of rows) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
    if (!shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)) continue;
    somaJanAll += r.valorBaixado;
    linhasJanAll++;
  }
  console.log('\nJan/2026 TODAS empresas (códigos 10000-12):', somaJanAll.toFixed(2), 'linhas', linhasJanAll);

  const ok = Math.abs(somaJan - META) / META <= TOLERANCIA || Math.abs(somaJanAll - META) / META <= TOLERANCIA;
  if (!ok) {
    console.log('\nAmostra códigos plano jan:');
    const codigos = new Map<number, number>();
    for (const r of rows) {
      if (r.tipoConta?.toUpperCase() !== 'R') continue;
      const baixa = formatYmd(r.dataBaixa);
      if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
      if (!shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)) continue;
      const c = r.idPlanoContas ?? 0;
      codigos.set(c, (codigos.get(c) ?? 0) + r.valorBaixado);
    }
    console.log([...codigos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
    const porEmp = new Map<string, number>();
    for (const r of rows) {
      if (r.tipoConta?.toUpperCase() !== 'R') continue;
      const baixa = formatYmd(r.dataBaixa);
      if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
      if (!shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)) continue;
      const e = r.empresa ?? '(vazio)';
      porEmp.set(e, (porEmp.get(e) ?? 0) + r.valorBaixado);
    }
    console.log('Por empresa:', [...porEmp.entries()].sort((a, b) => b[1] - a[1]));
    for (const id of [1, 2, 3, 4] as const) {
      let s = 0;
      for (const r of rows) {
        if (r.tipoConta?.toUpperCase() !== 'R') continue;
        const baixa = formatYmd(r.dataBaixa);
        if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
        if (!shop9CodigoEhReceitaVendasProduto(r.idPlanoContas)) continue;
        if (linhaShop9MatchesNomusEmpresa(r, id)) s += r.valorBaixado;
      }
      console.log(`  idEmpresa ${id}:`, s.toFixed(2));
    }
  }
  const PLANOS_META = new Set([10001, 10004, 10007]);
  let somaPlanos = 0;
  for (const r of rows) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
    const cod = r.idPlanoContas ?? 0;
    if (!PLANOS_META.has(cod)) continue;
    somaPlanos += r.valorBaixado;
  }
  console.log('\nJan/2026 códigos 10001+10004+10007 (todas emp):', somaPlanos.toFixed(2));

  let somaRn = 0;
  for (const r of rows) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
    if (!PLANOS_META.has(r.idPlanoContas ?? 0)) continue;
    if (!/marques/i.test(r.empresa ?? '')) continue;
    somaRn += r.valorBaixado;
  }
  console.log('Jan/2026 10001+10004+10007 só RN Marques:', somaRn.toFixed(2));

  let soma12 = 0;
  for (const r of rows) {
    if (r.tipoConta?.toUpperCase() !== 'R') continue;
    const baixa = formatYmd(r.dataBaixa);
    if (!baixa || baixa < '2026-01-01' || baixa > '2026-01-31') continue;
    if (!PLANOS_META.has(r.idPlanoContas ?? 0)) continue;
    if (!linhaShop9MatchesNomusEmpresa(r, 1) && !linhaShop9MatchesNomusEmpresa(r, 2)) continue;
    soma12 += r.valorBaixado;
  }
  console.log('Jan/2026 10001+10004+10007 emp 1+2 (filial):', soma12.toFixed(2));

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
