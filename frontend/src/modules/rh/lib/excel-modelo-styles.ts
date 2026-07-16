import type ExcelJS from "exceljs";

export type ExcelCellStyleTemplate = {
  fill?: ExcelJS.Fill;
  font?: Partial<ExcelJS.Font>;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
  numFmt?: string;
};

export function cloneExcelStyleValue<T>(value: T | undefined): T | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Extrai estilos de uma linha do modelo (ex.: linha 2 = padrão de dados). */
export function extractRowStyleTemplates(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
): ExcelCellStyleTemplate[] {
  const row = worksheet.getRow(rowNumber);
  const templates: ExcelCellStyleTemplate[] = [];
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    templates.push({
      fill: cloneExcelStyleValue(cell.fill),
      font: cloneExcelStyleValue(cell.font),
      alignment: cloneExcelStyleValue(cell.alignment),
      border: cloneExcelStyleValue(cell.border),
      numFmt: typeof cell.numFmt === "string" ? cell.numFmt : undefined,
    });
  }
  return templates;
}

export function applyExcelCellStyleTemplate(
  cell: ExcelJS.Cell,
  template: ExcelCellStyleTemplate | undefined,
): void {
  if (!template) return;
  if (template.fill) cell.fill = cloneExcelStyleValue(template.fill) as ExcelJS.Fill;
  if (template.font) cell.font = cloneExcelStyleValue(template.font) as Partial<ExcelJS.Font>;
  if (template.alignment) {
    cell.alignment = cloneExcelStyleValue(template.alignment) as Partial<ExcelJS.Alignment>;
  }
  if (template.border) cell.border = cloneExcelStyleValue(template.border) as Partial<ExcelJS.Borders>;
  if (template.numFmt) cell.numFmt = template.numFmt;
}

export function applyRowStyleTemplates(
  row: ExcelJS.Row,
  templates: ExcelCellStyleTemplate[],
): void {
  for (let col = 1; col <= templates.length; col++) {
    applyExcelCellStyleTemplate(row.getCell(col), templates[col - 1]);
  }
}
