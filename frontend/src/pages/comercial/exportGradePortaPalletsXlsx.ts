import { Workbook } from 'exceljs';
import type { ColunaGrade } from './GradePortaPallets';

function nomeArquivo(base: string): string {
  const limpo = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${limpo || 'porta-pallets'}.xlsx`;
}

/** Espelho da grade: mesmas colunas, linhas já filtradas e ordenadas, e o total filtrado no rodapé. */
export async function exportarGradeXlsx<T>(
  titulo: string,
  colunas: ColunaGrade<T>[],
  rows: T[],
  totais: Record<string, number>
): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Dados', { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.addRow([titulo]).font = { bold: true, size: 12 };
  const cabecalho = ws.addRow(colunas.map((c) => c.label));
  cabecalho.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041E42' } };
  });

  for (const row of rows) {
    const linha = ws.addRow(
      colunas.map((c) => {
        if ((c.tipo === 'moeda' || c.tipo === 'numero') && c.valor) {
          const v = c.valor(row);
          return typeof v === 'number' && Number.isFinite(v) ? v : null;
        }
        const t = c.texto(row);
        return t === '—' ? '' : t;
      })
    );
    colunas.forEach((c, i) => {
      if (c.tipo === 'moeda') linha.getCell(i + 1).numFmt = '#,##0.00';
      if (c.tipo === 'numero') linha.getCell(i + 1).numFmt = '#,##0.##';
    });
  }

  if (Object.keys(totais).length > 0 && rows.length > 0) {
    const total = ws.addRow(colunas.map((c, i) => (c.id in totais ? totais[c.id]! : i === 0 ? 'Total filtrado' : '')));
    total.font = { bold: true };
    colunas.forEach((c, i) => {
      if (c.tipo === 'moeda') total.getCell(i + 1).numFmt = '#,##0.00';
      if (c.tipo === 'numero') total.getCell(i + 1).numFmt = '#,##0.##';
    });
  }

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: colunas.length } };
  colunas.forEach((c, i) => {
    const maior = Math.max(c.label.length, ...rows.slice(0, 300).map((r) => c.texto(r).length));
    ws.getColumn(i + 1).width = Math.min(60, Math.max(10, maior + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo(titulo);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
