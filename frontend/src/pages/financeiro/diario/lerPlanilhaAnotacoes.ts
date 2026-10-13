import { Workbook, type CellValue } from 'exceljs';

function textoCelula(valor: CellValue): string {
  if (valor == null) return '';
  if (valor instanceof Date) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'object') {
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text ?? '').join('').trim();
    }
    if ('text' in valor && valor.text != null) return String(valor.text).trim();
    if ('result' in valor && valor.result != null && typeof valor.result !== 'object') return String(valor.result).trim();
  }
  return String(valor).trim();
}

/** Lê a primeira aba como matriz de texto para o backend casar com as contas a pagar. */
export async function lerPlanilhaAnotacoes(arquivo: File): Promise<string[][]> {
  const wb = new Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('A planilha não tem aba.');
  const matriz: string[][] = [];
  const limite = Math.min(ws.rowCount, 5000);
  for (let r = 1; r <= limite; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    const total = Math.max(row.cellCount, 13);
    for (let c = 1; c <= total; c++) cells.push(textoCelula(row.getCell(c).value));
    if (cells.some((c) => c.trim())) matriz.push(cells);
  }
  if (matriz.length === 0) throw new Error('A planilha está vazia.');
  return matriz;
}
