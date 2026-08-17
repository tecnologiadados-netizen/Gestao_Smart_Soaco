import { Workbook } from 'exceljs';
import type { TituloPainelInadimplencia } from '../../../../api/crmFinanceiro';
import { isFeriadoReconhecido } from './feriados-nacionais';
import { formatWeekday } from './formatters';

const HEADERS = [
  'Cliente',
  'Empresa',
  'Conta',
  'Condição',
  'Data vencim.',
  'Dia da semana',
  'Feriado',
  'Data recebim.',
  'Dias atraso',
  'Valor',
  'Tratativas',
] as const;

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF1E22AA' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const MONEY_FMT = '"R$" #,##0.00';

function ymdToDate(ymd: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function nomeArquivo(titulo: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `inadimplentes-painel-${slug || 'detalhe'}-${stamp}.xlsx`;
}

export async function downloadPainelInadimplenciaDetalheXlsx(input: {
  linhas: TituloPainelInadimplencia[];
  titulo: string;
  diasAtraso: (row: TituloPainelInadimplencia) => number | null;
}): Promise<void> {
  if (input.linhas.length === 0) {
    throw new Error('Não há linhas visíveis na grade para gerar o Excel.');
  }

  const wb = new Workbook();
  const ws = wb.addWorksheet('Detalhe', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.addRow([...HEADERS]);
  const header = ws.getRow(1);
  header.font = HEADER_FONT;
  header.alignment = { vertical: 'middle', wrapText: true };
  for (let c = 1; c <= HEADERS.length; c++) {
    header.getCell(c).fill = HEADER_FILL;
  }
  header.height = 22;

  for (const row of input.linhas) {
    const venc = row.vencimento;
    const recebido = row.pagamento ?? row.dataBaixa;
    const excelRow = ws.addRow([
      row.clienteNome,
      row.empresaNome?.trim() || '',
      row.codigoConta,
      row.tipo?.trim() || '',
      ymdToDate(venc),
      formatWeekday(venc) ?? '',
      isFeriadoReconhecido(venc) ? 'Sim' : 'Não',
      ymdToDate(recebido),
      input.diasAtraso(row) ?? '',
      Number.isFinite(row.valor) ? row.valor : 0,
      row.contatosCount,
    ]);
    excelRow.getCell(5).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(8).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(10).numFmt = MONEY_FMT;
  }

  const total = input.linhas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0);
  const totalRow = ws.addRow(['', '', '', '', '', '', '', 'Total', '', total, '']);
  totalRow.font = { bold: true };
  totalRow.getCell(10).numFmt = MONEY_FMT;

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };

  const widths = [32, 22, 12, 22, 14, 16, 10, 14, 12, 14, 12];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input.titulo);
  a.click();
  URL.revokeObjectURL(url);
}
