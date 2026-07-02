/**
 * Validação pontual: empenho bruto MP 3916 (filtro attr 313 + PD Estoque sempre).
 * Uso: npx tsx backend/scripts/validar-empenho-mp3916.ts
 */
import 'dotenv/config';
import { getNomusPool, isNomusEnabled } from '../src/config/nomusDb.js';
import { listarEmpenhoRessupPorPedido } from '../src/data/comprasRepository.js';
import { loadBomListaMateriaisAcabadoSemProdutoSql } from '../src/data/bomListaMateriaisSql.js';

const COD_MP = '3916';
const PD_ESTOQUE = 'PD 44711';
const PD_EXEMPLO = 'PD 49187';

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
    `Select id, nome From produto Where nome = ? Or nome Like ? Limit 5`,
    [COD_MP, `%${COD_MP}%`]
  )) as [Record<string, unknown>[], unknown];

  const prod = (prodRows ?? []).find((r) => String(r.nome ?? '').includes(COD_MP));
  if (!prod) {
    console.error(`Produto MP ${COD_MP} não encontrado.`);
    process.exit(1);
  }
  const idProduto = Number(prod.id);
  console.log(`idProduto MP ${COD_MP}:`, idProduto);

  for (const req of [false, true] as const) {
    const { data, erro } = await listarEmpenhoRessupPorPedido(idProduto, req);
    if (erro || !data) {
      console.error(`Erro (req=${req}):`, erro);
      continue;
    }
    console.log(`\n=== considerarRequisicoes=${req} ===`);
    console.log('totalBruto:', data.totalBruto);
    console.log('empenhoRequisicao:', data.empenhoRequisicao);
    console.log('empenhoPdEstoque:', data.empenhoPdEstoque);
    console.log('vendaDireta:', data.vendaDireta);
    console.log('totalLiquido:', data.totalLiquido);

    const linha44711 = data.linhas.find((l) => l.pedido.trim().toUpperCase() === PD_ESTOQUE);
    console.log(`${PD_ESTOQUE} bruto:`, linha44711?.bruto ?? '— (não encontrado — ERRO)');

    const linha49187 = data.linhas.find((l) => l.pedido.trim().toUpperCase() === PD_EXEMPLO.toUpperCase());
    console.log(`${PD_EXEMPLO} bruto:`, linha49187?.bruto ?? '—');

    const reqs = data.linhas.filter((l) => l.rota === 'Requisição');
    console.log('Linhas Requisição:', reqs.length, 'Σ bruto', reqs.reduce((s, l) => s + l.bruto, 0));
  }

  const bom = loadBomListaMateriaisAcabadoSemProdutoSql();
  const [dupRows] = (await pool.query(
    `Select bom.idprodutopai, pp.nome As codPa, Count(*) As linhas
     From (${bom}) bom
     Inner Join produto pp On pp.id = bom.idprodutopai
     Where bom.idcomponente = ?
     Group By bom.idprodutopai, pp.nome
     Having linhas > 1`,
    [idProduto]
  )) as [Record<string, unknown>[], unknown];

  if ((dupRows ?? []).length > 0) {
    console.log('\nPAs com múltiplas linhas BOM:', dupRows);
  } else {
    console.log('\nNenhum PA com linhas BOM duplicadas.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
