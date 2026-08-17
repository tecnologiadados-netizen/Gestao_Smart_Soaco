import { Workbook } from 'exceljs';
import type { TarefaInadimplente } from '../../../../api/crmFinanceiro';

const HEADERS = [
  'Data vencim.',
  'Data baixa',
  'Data recebim.',
  'Origem',
  'Empresa',
  'Cliente',
  'Conta',
  'Banco',
  'Valor',
  'Atraso (dias)',
  'Status',
  'Responsável',
  'NF / PD',
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

function labelStatus(s: string): string {
  if (s === 'em_contato') return 'Atrasado - Em contato';
  if (s === 'concluida') return 'Concluída';
  return 'Em atraso';
}

function nomeArquivo(tituloFila: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = tituloFila
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `inadimplentes-tarefas-${slug || 'export'}-${stamp}.xlsx`;
}

export async function downloadTarefasInadimplentesXlsx(input: {
  linhas: TarefaInadimplente[];
  tituloFila: string;
}): Promise<void> {
  if (input.linhas.length === 0) {
    throw new Error('Não há linhas visíveis na grade para gerar o Excel.');
  }

  const wb = new Workbook();
  const ws = wb.addWorksheet('Tarefas', {
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
    const excelRow = ws.addRow([
      ymdToDate(row.vencimento),
      ymdToDate(row.dataBaixa),
      ymdToDate(row.pagamento),
      row.origem.toUpperCase(),
      row.empresaNome?.trim() || '',
      row.clienteNome,
      row.codigoConta,
      row.banco?.trim() || '',
      Number.isFinite(row.valor) ? row.valor : 0,
      row.diasAtraso,
      labelStatus(row.status),
      row.responsavelNome?.trim() || row.responsavelLogin?.trim() || '',
      row.nfPd?.trim() || '',
      row.contatosCount,
    ]);
    excelRow.getCell(1).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(2).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(3).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(9).numFmt = MONEY_FMT;
  }

  const total = input.linhas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0);
  const totalRow = ws.addRow(['', '', '', '', '', '', '', 'Total', total, '', '', '', '', '']);
  totalRow.font = { bold: true };
  totalRow.getCell(9).numFmt = MONEY_FMT;

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };

  const widths = [12, 12, 12, 10, 22, 32, 12, 22, 14, 12, 22, 18, 12, 10];
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
  a.download = nomeArquivo(input.tituloFila);
  a.click();
  URL.revokeObjectURL(url);
}
