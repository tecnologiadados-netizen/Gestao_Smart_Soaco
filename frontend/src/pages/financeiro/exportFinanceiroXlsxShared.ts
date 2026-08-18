import type { Workbook, Worksheet } from 'exceljs';

export const DATE_FMT = 'dd/mm/yyyy';
export const MONEY_FMT = 'R$ #,##0.00';
export const PCT_FMT = '0.0%';

export const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF1E3A5F' },
};
export const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
export const TOTAL_FONT = { bold: true };

export function toExcelDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function styleHeader(ws: Worksheet, colCount: number) {
  const row = ws.getRow(1);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

export function autosize(ws: Worksheet, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    let max = 10;
    ws.eachRow((row) => {
      const v = row.getCell(c).value;
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = Math.min(len, 48);
    });
    ws.getColumn(c).width = max + 2;
  }
}

export function addFiltrosSheet(
  wb: Workbook,
  rows: Array<[string, string | number | boolean]>,
  avisos: string[] = [],
) {
  const ws = wb.addWorksheet('Filtros');
  ws.addRow(['Campo', 'Valor']);
  styleHeader(ws, 2);
  for (const [k, v] of rows) {
    ws.addRow([k, v === true ? 'Sim' : v === false ? 'Não' : v]);
  }
  if (avisos.length > 0) {
    ws.addRow([]);
    const avisoHeader = ws.addRow(['Avisos', '']);
    avisoHeader.font = TOTAL_FONT;
    for (const a of avisos) ws.addRow(['', a]);
  }
  autosize(ws, 2);
}

export async function baixarWorkbook(wb: Workbook, nomeArquivo: string): Promise<void> {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function nomeArquivoPeriodo(prefixo: string, inicio: string, fim: string, granularidade: string): string {
  return `${prefixo}_${inicio}_${fim}_${granularidade}.xlsx`;
}
