/**
 * Testa conexão Shop9 e agregação DFC.
 * Uso (pasta backend): npx tsx scripts/test-shop9-dfc.ts
 */
import 'dotenv/config';
import { testarConexaoShop9, carregarLinhasShop9Financeiro, queryDfcShop9RetroAgregado } from '../src/data/dfcShop9Repository.js';

async function main() {
  const t = await testarConexaoShop9();
  console.log('Conexão:', t);
  if (!t.ok) process.exit(1);

  const { rows } = await carregarLinhasShop9Financeiro(true);
  console.log('Linhas brutas:', rows.length);

  const empresas = [...new Set(rows.map((r) => r.empresa).filter(Boolean))].sort();
  console.log('Empresas distintas (amostra):', empresas.slice(0, 20));

  const rn = rows.filter((r) => /marques/i.test(r.empresa ?? ''));
  console.log('Linhas com Marques no campo empresa:', rn.length);
  if (rn[0]) console.log('Exemplo RN:', rn[0].empresa);

  const hoje = new Date().toISOString().slice(0, 10);
  const retro = await queryDfcShop9RetroAgregado({
    dataBaixaInicio: '2024-01-01',
    dataBaixaFim: hoje,
    granularidade: 'mes',
    idEmpresas: [1, 2, 3, 4],
  });
  console.log('Retro agregado (mês, ids 1-4):', retro.linhas.length, 'buckets');
  console.log('Amostra:', retro.linhas.slice(0, 5));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
