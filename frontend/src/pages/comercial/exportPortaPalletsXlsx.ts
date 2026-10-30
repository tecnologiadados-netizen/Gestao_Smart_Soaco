import { Workbook } from 'exceljs';
import type { LinhaPedidoItem, LinhaPropostaItem } from '../../api/portaPalletsComercial';
import { formatData, simNao } from './portaPalletsComercialFormat';

function pintarCabecalho(cell: { font: object; fill: object }) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041E42' } };
}

function baixar(buffer: BlobPart, nome: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportarPortaPalletsXlsx(
  propostas: LinhaPropostaItem[],
  pedidos: LinhaPedidoItem[]
): Promise<void> {
  const wb = new Workbook();

  const abaPropostas = wb.addWorksheet('Propostas');
  abaPropostas.addRow([
    'Mês',
    'Proposta',
    'Abertura',
    'Cliente',
    'Produto',
    'Descrição',
    'Valor',
    'Status',
    'Motivo da rejeição',
    'Proposta convertida',
    'Pedidos',
    'Primeiro pedido',
    'Dias até o pedido',
  ]);
  abaPropostas.getRow(1).eachCell((cell) => pintarCabecalho(cell));
  for (const linha of propostas) {
    const row = abaPropostas.addRow([
      linha.mes,
      linha.codigoProposta,
      formatData(linha.dataAbertura),
      linha.cliente,
      linha.codigoProduto,
      linha.descricaoProduto,
      linha.valor,
      linha.statusLabel,
      linha.motivoRejeicao,
      simNao(linha.propostaConvertida),
      linha.codigosPedido,
      formatData(linha.dataPrimeiroPedido),
      linha.dias,
    ]);
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(13).numFmt = '0.0';
  }
  abaPropostas.columns.forEach((col, i) => {
    col.width = [10, 16, 14, 36, 16, 42, 16, 18, 28, 20, 24, 16, 18][i] ?? 16;
  });

  const abaPedidos = wb.addWorksheet('Pedidos');
  abaPedidos.addRow([
    'Mês',
    'Pedido',
    'Emissão',
    'Cliente',
    'Produto',
    'Descrição',
    'Valor vendido',
    'Primeira compra',
  ]);
  abaPedidos.getRow(1).eachCell((cell) => pintarCabecalho(cell));
  for (const linha of pedidos) {
    const row = abaPedidos.addRow([
      linha.mes,
      linha.codigoPedido,
      formatData(linha.dataEmissao),
      linha.cliente,
      linha.codigoProduto,
      linha.descricaoProduto,
      linha.valorVendido,
      simNao(linha.primeiraCompra),
    ]);
    row.getCell(7).numFmt = '#,##0.00';
  }
  abaPedidos.columns.forEach((col, i) => {
    col.width = [10, 16, 14, 36, 16, 42, 16, 18][i] ?? 16;
  });

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer, 'porta-pallets-dados-abertos.xlsx');
}
