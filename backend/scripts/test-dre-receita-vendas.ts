import 'dotenv/config';
import { queryDreReceitaVendasProdutos } from '../src/data/dreReceitaVendasRepository.js';

async function main() {
  const r = await queryDreReceitaVendasProdutos({
    dataInicio: '2026-01-01',
    dataFim: '2026-05-28',
  });
  console.log('erro:', r.erro ?? '(nenhum)');
  console.log('linhas:', r.linhas.length);
  const grupos = new Set(r.linhas.map((l) => l.grupoProduto));
  console.log('grupos:', [...grupos].sort().join(' | '));
  console.log('total:', r.linhas.reduce((s, x) => s + x.valorTotal, 0).toFixed(2));
  if (r.linhas[0]) console.log('amostra:', r.linhas[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
