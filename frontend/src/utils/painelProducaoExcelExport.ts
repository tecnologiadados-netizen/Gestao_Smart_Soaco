import ExcelJS from 'exceljs';
import type {
  PainelProducaoApuracaoDetalhe,
  PainelProducaoPedidoDetalhe,
} from '../api/painelProducao';

const NAVY = '041E42';
const BLUE = '1E22AA';
const GOLD = 'FFAD00';
const ZEBRA = 'F4F6FA';
const INK = '2E2D2C';

function slugArquivo(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'export';
}

async function baixarWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function aplicarCabecalhoDocumento(
  sheet: ExcelJS.Worksheet,
  opts: {
    titulo: string;
    metadados: Array<{ rotulo: string; valor: string }>;
    colCount: number;
  },
): number {
  const { titulo, metadados, colCount } = opts;
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = titulo;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${NAVY}` } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GOLD}` } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  metadados.forEach((meta, index) => {
    const row = 2 + index;
    sheet.getCell(row, 1).value = meta.rotulo;
    sheet.getCell(row, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${BLUE}` } };
    sheet.mergeCells(row, 2, row, colCount);
    sheet.getCell(row, 2).value = meta.valor;
    sheet.getCell(row, 2).font = { name: 'Calibri', size: 10, color: { argb: `FF${INK}` } };
  });

  return 2 + metadados.length + 1; // próxima linha livre (após linha em branco implícita)
}

function estilizarCabecalhoColunas(sheet: ExcelJS.Worksheet, rowNumber: number, colCount: number): void {
  const row = sheet.getRow(rowNumber);
  row.height = 20;
  for (let col = 1; col <= colCount; col += 1) {
    const cell = row.getCell(col);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: `FF${NAVY}` } },
      bottom: { style: 'thin', color: { argb: `FF${NAVY}` } },
      left: { style: 'thin', color: { argb: `FF${NAVY}` } },
      right: { style: 'thin', color: { argb: `FF${NAVY}` } },
    };
  }
}

function estilizarLinhaDados(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  colCount: number,
  zebra: boolean,
): void {
  const row = sheet.getRow(rowNumber);
  for (let col = 1; col <= colCount; col += 1) {
    const cell = row.getCell(col);
    cell.font = { name: 'Calibri', size: 10, color: { argb: `FF${INK}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ZEBRA}` } };
    }
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFD0D5DD' } },
      bottom: { style: 'hair', color: { argb: 'FFD0D5DD' } },
      left: { style: 'hair', color: { argb: 'FFD0D5DD' } },
      right: { style: 'hair', color: { argb: 'FFD0D5DD' } },
    };
  }
}

function ajustarLarguras(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/** Exporta o detalhe tabular da Apuração (pedidos encerrados / alterações). */
export async function exportarApuracaoDetalheExcel(
  detalhe: PainelProducaoApuracaoDetalhe,
): Promise<void> {
  const mostraAlteracao =
    detalhe.tipo === 'alteracoes' || detalhe.tipo === 'alteracoes_ruptura';

  const headers = mostraAlteracao
    ? [
        'Pedido',
        'Cliente',
        'Produto',
        'Descrição',
        'Quantidade',
        'Data alteração',
        'Motivo',
        'Usuário',
        'Anexo PDF',
      ]
    : ['Pedido', 'Cliente', 'Produto', 'Descrição', 'Quantidade', 'Status', 'Encerramento'];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestão Smart';
  workbook.created = new Date();

  const sheetName = (detalhe.titulo || 'Detalhe').slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  const headerRow = aplicarCabecalhoDocumento(sheet, {
    titulo: detalhe.titulo || 'Detalhe da apuração',
    metadados: [
      { rotulo: 'Setor', valor: detalhe.setor || '—' },
      { rotulo: 'Mês', valor: detalhe.mes || '—' },
      {
        rotulo: 'Resumo',
        valor: mostraAlteracao
          ? `${detalhe.total} alterações · ${detalhe.linhas.length} itens listados`
          : `${detalhe.total} pedidos · ${detalhe.linhas.length} itens listados`,
      },
    ],
    colCount: headers.length,
  });

  const colHeaderRow = headerRow + 1;
  headers.forEach((h, i) => {
    sheet.getCell(colHeaderRow, i + 1).value = h;
  });
  estilizarCabecalhoColunas(sheet, colHeaderRow, headers.length);

  detalhe.linhas.forEach((linha, index) => {
    const rowNumber = colHeaderRow + 1 + index;
    const values = mostraAlteracao
      ? [
          linha.pedido,
          linha.cliente,
          linha.codigo_produto,
          linha.descricao,
          linha.quantidade ?? '',
          linha.data_alteracao ?? '',
          linha.motivo ?? '',
          linha.usuario ?? '',
          linha.anexo_assinatura_nome?.trim() || (linha.anexo_assinatura_path ? 'PDF anexado' : ''),
        ]
      : [
          linha.pedido,
          linha.cliente,
          linha.codigo_produto,
          linha.descricao,
          linha.quantidade ?? '',
          linha.status ?? '',
          linha.data_encerramento ?? '',
        ];
    values.forEach((v, i) => {
      sheet.getCell(rowNumber, i + 1).value = v;
    });
    estilizarLinhaDados(sheet, rowNumber, headers.length, index % 2 === 1);
    // Quantidade alinhada à direita (coluna 5)
    sheet.getCell(rowNumber, 5).alignment = {
      vertical: 'middle',
      horizontal: 'right',
    };
  });

  const lastDataRow = colHeaderRow + Math.max(detalhe.linhas.length, 1);
  sheet.autoFilter = {
    from: { row: colHeaderRow, column: 1 },
    to: { row: lastDataRow, column: headers.length },
  };
  sheet.views = [{ state: 'frozen', ySplit: colHeaderRow }];

  ajustarLarguras(
    sheet,
    mostraAlteracao
      ? [14, 28, 12, 44, 12, 18, 36, 16, 28]
      : [14, 28, 12, 44, 12, 20, 20],
  );

  const mesSlug = slugArquivo(detalhe.mes || 'mes');
  const setorSlug = slugArquivo(detalhe.setor || 'setor');
  const tipoSlug = slugArquivo(detalhe.tipo || 'detalhe');
  await baixarWorkbook(workbook, `apuracao-${tipoSlug}-${setorSlug}-${mesSlug}.xlsx`);
}

/** Exporta o popover de pedidos contabilizados no dashboard (unidade pedidos). */
export async function exportarPedidosDashboardExcel(
  pedidos: PainelProducaoPedidoDetalhe[],
  opts?: { setor?: string; mes?: string },
): Promise<void> {
  const headers = ['Pedido', 'Cliente', 'Produto', 'Descrição'];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestão Smart';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Pedidos', {
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  const headerRow = aplicarCabecalhoDocumento(sheet, {
    titulo: 'Pedidos contabilizados na produção',
    metadados: [
      { rotulo: 'Setor', valor: opts?.setor || '—' },
      { rotulo: 'Mês', valor: opts?.mes || '—' },
      { rotulo: 'Resumo', valor: `${pedidos.length} pedido(s)` },
    ],
    colCount: headers.length,
  });

  const colHeaderRow = headerRow + 1;
  headers.forEach((h, i) => {
    sheet.getCell(colHeaderRow, i + 1).value = h;
  });
  estilizarCabecalhoColunas(sheet, colHeaderRow, headers.length);

  let rowIndex = 0;
  for (const pedido of pedidos) {
    const itens = pedido.itens.length > 0 ? pedido.itens : [{ codigo: '', descricao: '' }];
    for (const item of itens) {
      const rowNumber = colHeaderRow + 1 + rowIndex;
      [pedido.codigo_pedido, pedido.cliente, item.codigo, item.descricao].forEach((v, i) => {
        sheet.getCell(rowNumber, i + 1).value = v;
      });
      estilizarLinhaDados(sheet, rowNumber, headers.length, rowIndex % 2 === 1);
      rowIndex += 1;
    }
  }

  const lastDataRow = colHeaderRow + Math.max(rowIndex, 1);
  sheet.autoFilter = {
    from: { row: colHeaderRow, column: 1 },
    to: { row: lastDataRow, column: headers.length },
  };
  sheet.views = [{ state: 'frozen', ySplit: colHeaderRow }];
  ajustarLarguras(sheet, [14, 32, 12, 52]);

  const mesSlug = slugArquivo(opts?.mes || 'mes');
  const setorSlug = slugArquivo(opts?.setor || 'setor');
  await baixarWorkbook(workbook, `pedidos-producao-${setorSlug}-${mesSlug}.xlsx`);
}
