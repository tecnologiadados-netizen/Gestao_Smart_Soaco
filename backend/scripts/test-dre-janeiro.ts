import 'dotenv/config';
import { queryDreReceitaVendasProdutos } from '../src/data/dreReceitaVendasRepository.js';

const ALVOS = {
  'Resfriador industrial': 823698.11,
  'Material comprado': 733.12,
  total: 2026706.97,
};

async function run(ano: number) {
  const r = await queryDreReceitaVendasProdutos({
    dataInicio: `${ano}-01-01`,
    dataFim: `${ano}-01-31`,
  });
  const jan = r.linhas.filter((l) => l.mes === 1 && l.ano === ano && l.idItemPedidoSM === 'So Aco');
  const porGrupo = new Map<string, number>();
  for (const l of jan) {
    porGrupo.set(l.grupoProduto, (porGrupo.get(l.grupoProduto) ?? 0) + l.valorTotal);
  }
  const total = jan.reduce((s, x) => s + x.valorTotal, 0);
  const resfriadorKeys = [...porGrupo.keys()].filter((k) => /resfriador/i.test(k));
  console.log(`\n=== Janeiro ${ano} === erro: ${r.erro ?? 'ok'}`);
  console.log('total grupos (fat. direto):', total.toFixed(2), '| excel receita bruta:', ALVOS.total, '| excel fat. direto: 1648249.30');
  if (resfriadorKeys.length) {
    for (const k of resfriadorKeys) console.log(`  nomus [${k}]:`, (porGrupo.get(k) ?? 0).toFixed(2));
  }
  for (const [g, esperado] of Object.entries(ALVOS)) {
    if (g === 'total') continue;
    const v = porGrupo.get(g) ?? 0;
    console.log(`  ${g}: ${v.toFixed(2)} (excel ${esperado})`);
  }
}

for (const ano of [2025, 2026]) {
  await run(ano);
}
