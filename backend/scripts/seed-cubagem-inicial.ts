/**
 * Carga inicial de veículos e dimensões de produtos (cubagem).
 *
 * Uso: npx tsx scripts/seed-cubagem-inicial.ts
 */

import { prisma } from '../src/config/prisma.js';
import { upsertVeiculoPorPlaca } from '../src/data/cubagemRepository.js';
import { obterProdutoElegivelPorCodigo } from '../src/data/cubagemProdutosNomus.js';
import { salvarProdutoCubagem } from '../src/data/cubagemRepository.js';

const VEICULOS_INICIAIS: Array<{
  modelo: string;
  placa: string;
  alturaMm: number | null;
  larguraMm: number | null;
  profundidadeMm: number | null;
}> = [
  { modelo: 'ACCELO 815 - M.BENZ', placa: 'PIW7H75', alturaMm: 2940, larguraMm: 2180, profundidadeMm: 6890 },
  { modelo: 'ACCELO 815 - M.BENZ', placa: 'NIW6C51', alturaMm: 2940, larguraMm: 2070, profundidadeMm: 6890 },
  { modelo: 'F350 G - FORD', placa: 'NIG7F97', alturaMm: 2180, larguraMm: 2070, profundidadeMm: 3360 },
  { modelo: 'F350 G - FORD', placa: 'LVU1H85', alturaMm: 2100, larguraMm: 2080, profundidadeMm: 3420 },
  { modelo: 'F350 G - FORD', placa: 'LVU1H95', alturaMm: 2100, larguraMm: 2080, profundidadeMm: 3420 },
  { modelo: '24.280 CRM 6X2 - VW', placa: 'OEE4C36', alturaMm: 3000, larguraMm: 2480, profundidadeMm: 11170 },
  { modelo: 'IVECO DAILY - FIAT', placa: 'OUC6G80', alturaMm: 2090, larguraMm: 2070, profundidadeMm: 4380 },
  { modelo: 'IVECO DAILY - FIAT', placa: 'OUC6G70', alturaMm: 2090, larguraMm: 2070, profundidadeMm: 4380 },
  { modelo: 'ATEGO 1419 - M.BENZ', placa: 'RSM1F99', alturaMm: 3030, larguraMm: 2470, profundidadeMm: 9880 },
  { modelo: 'ATEGO 1419 - M.BENZ', placa: 'RSQ9B26', alturaMm: 3010, larguraMm: 2470, profundidadeMm: 8380 },
  { modelo: '710 - M.BENZ', placa: 'NHY8E04', alturaMm: null, larguraMm: null, profundidadeMm: null },
  { modelo: 'F350 G - FORD', placa: 'OEA1H17', alturaMm: null, larguraMm: null, profundidadeMm: null },
  { modelo: 'ATEGO 1419 - M.BENZ', placa: 'PIX1F44', alturaMm: null, larguraMm: null, profundidadeMm: null },
  { modelo: '24.250 CNC 6X2 - VW', placa: 'NIW6D58', alturaMm: null, larguraMm: null, profundidadeMm: null },
  { modelo: '24.250 CNC 6X2 - VW', placa: 'NIB5502', alturaMm: null, larguraMm: null, profundidadeMm: null },
];

const PRODUTOS_INICIAIS: Array<{
  codigo: string;
  alturaMm: number;
  larguraMm: number;
  profundidadeMm: number;
}> = [
  { codigo: 'PA 9366', alturaMm: 1625, larguraMm: 760, profundidadeMm: 355 },
  { codigo: 'PA 10133', alturaMm: 1625, larguraMm: 760, profundidadeMm: 355 },
  { codigo: 'PA 11506', alturaMm: 1950, larguraMm: 900, profundidadeMm: 300 },
  { codigo: 'PA 11505', alturaMm: 1950, larguraMm: 900, profundidadeMm: 300 },
  { codigo: 'PA 10425', alturaMm: 1975, larguraMm: 905, profundidadeMm: 400 },
  { codigo: 'PA 9374', alturaMm: 1330, larguraMm: 460, profundidadeMm: 700 },
  { codigo: 'PA 11404', alturaMm: 1935, larguraMm: 340, profundidadeMm: 410 },
  { codigo: 'PA 10604', alturaMm: 1935, larguraMm: 340, profundidadeMm: 410 },
  { codigo: 'PA 9326', alturaMm: 1935, larguraMm: 1020, profundidadeMm: 410 },
  { codigo: 'PA 9327', alturaMm: 1935, larguraMm: 1020, profundidadeMm: 410 },
  { codigo: 'PA 9323', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 11195', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 9328', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 9827', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 11358', alturaMm: 1935, larguraMm: 680, profundidadeMm: 410 },
  { codigo: 'PA 11686', alturaMm: 1935, larguraMm: 1020, profundidadeMm: 410 },
  { codigo: 'PA 10598', alturaMm: 1935, larguraMm: 1020, profundidadeMm: 410 },
  { codigo: 'PA 11690', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 10367', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 10234', alturaMm: 1935, larguraMm: 1020, profundidadeMm: 410 },
  { codigo: 'PA 9437', alturaMm: 1935, larguraMm: 1360, profundidadeMm: 410 },
  { codigo: 'PA 11052', alturaMm: 1935, larguraMm: 1700, profundidadeMm: 410 },
];

async function main() {
  console.log('=== Carga inicial Cubagem ===\n');

  let veiculosOk = 0;
  for (const v of VEICULOS_INICIAIS) {
    await upsertVeiculoPorPlaca({
      placa: v.placa,
      modelo: v.modelo,
      alturaMm: v.alturaMm,
      larguraMm: v.larguraMm,
      profundidadeMm: v.profundidadeMm,
      ativo: true,
    });
    veiculosOk++;
    const dim =
      v.alturaMm != null ? `${v.alturaMm}×${v.larguraMm}×${v.profundidadeMm} mm` : 'dimensões pendentes';
    console.log(`Veículo ${v.placa}: ${dim}`);
  }
  console.log(`\nVeículos: ${veiculosOk} registrados.\n`);

  let produtosOk = 0;
  const produtosNaoEncontrados: string[] = [];

  for (const p of PRODUTOS_INICIAIS) {
    const nomus = await obterProdutoElegivelPorCodigo(p.codigo);
    if (!nomus) {
      produtosNaoEncontrados.push(p.codigo);
      console.warn(`Produto não encontrado no Nomus: ${p.codigo}`);
      continue;
    }
    await salvarProdutoCubagem({
      idProduto: nomus.idProduto,
      codigoProduto: nomus.codigoProduto,
      descricaoProduto: nomus.descricaoProduto,
      alturaMm: p.alturaMm,
      larguraMm: p.larguraMm,
      profundidadeMm: p.profundidadeMm,
      numVolumes: 1,
    });
    produtosOk++;
    console.log(`Produto ${nomus.codigoProduto}: ${p.alturaMm}×${p.larguraMm}×${p.profundidadeMm} mm`);
  }

  console.log(`\nProdutos dimensionados: ${produtosOk}/${PRODUTOS_INICIAIS.length}`);
  if (produtosNaoEncontrados.length > 0) {
    console.warn('Não encontrados no Nomus:', produtosNaoEncontrados.join(', '));
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
