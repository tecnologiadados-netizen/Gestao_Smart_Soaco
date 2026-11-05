import ExcelJS from 'exceljs';
import type { FaturamentoLinha } from '../../../api/painelProducao';

const MOEDA = '#,##0.00';

function textoLimpo(valor: string): string {
  return valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function dataLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export async function exportarFaturamentoExcel(mes: string, linhas: FaturamentoLinha[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const detalhe = workbook.addWorksheet('Detalhe');
  detalhe.columns = [
    { header: 'data_emissao', key: 'data', width: 16 },
    { header: 'nf', key: 'nf', width: 14 },
    { header: 'documento_saida', key: 'documento', width: 18 },
    { header: 'id_tipo_movimentacao', key: 'idTipo', width: 22 },
    { header: 'tipo_movimentacao', key: 'tipo', width: 52 },
    { header: 'numero_pedido', key: 'pedido', width: 16 },
    { header: 'codigo_produto', key: 'codigo', width: 18 },
    { header: 'produto', key: 'produto', width: 55 },
    { header: 'valor_faturado_sem_devolucao', key: 'faturado', width: 30 },
    { header: 'desconto', key: 'desconto', width: 16 },
    { header: 'valor_devolvido', key: 'devolvido', width: 18 },
    { header: 'total_liquido', key: 'liquido', width: 16 },
  ];
  detalhe.getRow(1).font = { bold: true };

  for (const linha of linhas) {
    const row = detalhe.addRow({
      data: dataLocal(linha.dataEmissao),
      nf: linha.nf,
      documento: linha.documento,
      idTipo: linha.idTipoMovimentacao,
      tipo: textoLimpo(linha.tipoMovimentacao),
      pedido: linha.numeroPedido ? textoLimpo(linha.numeroPedido) : null,
      codigo: textoLimpo(linha.codigoProduto),
      produto: textoLimpo(linha.produto),
      faturado: linha.faturado,
      desconto: linha.desconto,
      devolvido: linha.devolvido,
      liquido: linha.liquido,
    });
    row.getCell('data').numFmt = 'dd/mm/yyyy';
    for (const col of ['faturado', 'desconto', 'devolvido', 'liquido']) {
      row.getCell(col).numFmt = MOEDA;
    }
  }

  const porDia = new Map<string, { faturado: number; desconto: number; devolvido: number; liquido: number }>();
  for (const linha of linhas) {
    const atual = porDia.get(linha.dataEmissao) ?? { faturado: 0, desconto: 0, devolvido: 0, liquido: 0 };
    atual.faturado += linha.faturado;
    atual.desconto += linha.desconto;
    atual.devolvido += linha.devolvido;
    atual.liquido += linha.liquido;
    porDia.set(linha.dataEmissao, atual);
  }

  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Rótulos de Linha', key: 'dia', width: 22 },
    { header: 'Soma de valor_faturado_sem_devolucao', key: 'faturado', width: 40 },
    { header: 'Soma de desconto', key: 'desconto', width: 22 },
    { header: 'Soma de valor_devolvido', key: 'devolvido', width: 26 },
    { header: 'Soma de total_liquido', key: 'liquido', width: 24 },
  ];
  resumo.getRow(1).font = { bold: true };

  const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = { faturado: 0, desconto: 0, devolvido: 0, liquido: 0 };
  for (const [dia, valores] of dias) {
    const row = resumo.addRow({
      dia: dataLocal(dia),
      faturado: valores.faturado,
      desconto: valores.desconto,
      devolvido: valores.devolvido,
      liquido: valores.liquido,
    });
    row.getCell('dia').numFmt = 'dd/mm/yyyy';
    for (const col of ['faturado', 'desconto', 'devolvido', 'liquido']) {
      row.getCell(col).numFmt = MOEDA;
    }
    total.faturado += valores.faturado;
    total.desconto += valores.desconto;
    total.devolvido += valores.devolvido;
    total.liquido += valores.liquido;
  }
  const totalRow = resumo.addRow({
    dia: 'Total Geral',
    faturado: total.faturado,
    desconto: total.desconto,
    devolvido: total.devolvido,
    liquido: total.liquido,
  });
  totalRow.font = { bold: true };
  for (const col of ['faturado', 'desconto', 'devolvido', 'liquido']) {
    totalRow.getCell(col).numFmt = MOEDA;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
      : new Uint8Array(buffer);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Faturamento.${mes}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
