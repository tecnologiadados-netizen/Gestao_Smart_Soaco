import { Workbook } from 'exceljs';
import type { DetalheItemGondola } from '../../../api/gondolasPortaPaletes';
import { linhasDetalhamentoPorPedido } from './imprimirOrdemGondolas';

const COLUNAS = ['Pedido', 'Descrição da peça', 'Modelo', 'Matéria prima', 'Medida', 'Observações', 'Qtd total'];
const LARGURAS = [14, 60, 16, 22, 16, 30, 12];

function texto(valor: string): string {
  return valor === '—' ? '' : valor;
}

/**
 * Uma aba com todos os PP das ordens do pedido, nas colunas do PDF. Peça da planilha não tem tipo e conta como PP;
 * só o PI do Nomus fica de fora. A mesma peça sai numa linha só, com a quantidade somada. Devolve quantas linhas saíram.
 */
export async function exportarPpDoPedidoXlsx(pedido: string, detalhes: DetalheItemGondola[]): Promise<number> {
  const soPp = detalhes
    .map((detalhe) => ({ ...detalhe, componentes: detalhe.componentes.filter((componente) => componente.tipo !== 'PI') }))
    .filter((detalhe) => detalhe.componentes.length > 0);
  const linhas = linhasDetalhamentoPorPedido(soPp);
  if (linhas.length === 0) return 0;

  const wb = new Workbook();
  const ws = wb.addWorksheet('PP');
  const cabecalho = ws.addRow(COLUNAS);
  cabecalho.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041E42' } };
  });
  for (const linha of linhas) {
    const row = ws.addRow([
      linha.pedido,
      linha.descricao,
      texto(linha.modelo),
      texto(linha.materiaPrima),
      texto(linha.medida),
      texto(linha.observacao),
      linha.quantidadeTotal,
    ]);
    row.getCell(7).numFmt = '#,##0.##';
  }
  const total = ws.addRow(['TOTAL', '', '', '', '', '', linhas.reduce((soma, linha) => soma + linha.quantidadeTotal, 0)]);
  total.font = { bold: true };
  total.getCell(7).numFmt = '#,##0.##';

  LARGURAS.forEach((largura, indice) => {
    ws.getColumn(indice + 1).width = largura;
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PP-${pedido.replace(/[^\w-]+/g, '_')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return linhas.length;
}
