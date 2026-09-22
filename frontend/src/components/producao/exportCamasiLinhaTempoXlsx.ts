import { Workbook } from 'exceljs';
import { formatDuracaoDidatica, formatHmsCurto } from './camasiFormat';

export type CamasiLinhaTempoExport = {
  tipo: 'parada' | 'producao';
  data: string;
  inicio: string | null;
  fim: string | null;
  minutos: number;
  peca: string;
  justificativa: string;
  observacao: string | null;
};

const HEADERS = [
  'Tipo',
  'Data',
  'Início',
  'Fim',
  'Duração',
  'Peça',
  'Justificativa',
  'Observação',
] as const;

const DATE_FMT = 'dd/mm/yyyy';

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function ymdToDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function hmsOuVazio(hms: string | null | undefined): string {
  const t = formatHmsCurto(hms);
  return t === '—' ? '' : t;
}

function nomeArquivo(dataIni: string, dataFim: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `camasi-linha-tempo_${dataIni}_${dataFim}_${stamp}.xlsx`;
}

/**
 * Exporta a linha do tempo Camasi como Tabela Excel (filtros nativos),
 * sem células mescladas: a data se repete em cada linha.
 */
export async function downloadCamasiLinhaTempoXlsx(input: {
  linhas: CamasiLinhaTempoExport[];
  dataIni: string;
  dataFim: string;
}): Promise<void> {
  if (input.linhas.length === 0) {
    throw new Error('Não há linhas visíveis na grade para exportar.');
  }

  const rows = input.linhas.map((row) => [
    row.tipo === 'producao' ? 'Produção' : 'Parada',
    ymdToDate(row.data),
    hmsOuVazio(row.inicio),
    hmsOuVazio(row.fim),
    formatDuracaoDidatica(row.minutos),
    row.peca?.trim() || '',
    row.justificativa?.trim() || '',
    row.observacao?.trim() || '',
  ]);

  const wb = new Workbook();
  const ws = wb.addWorksheet('Linha do tempo', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const lastRow = rows.length + 1;
  const ref = `A1:${colLetter(HEADERS.length - 1)}${lastRow}`;

  ws.addTable({
    name: 'TabelaLinhaTempoCamasi',
    ref,
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: HEADERS.map((name) => ({ name, filterButton: true })),
    rows,
  });

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 28;
  ws.getColumn(7).width = 32;
  ws.getColumn(8).width = 36;

  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(r, 2).numFmt = DATE_FMT;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input.dataIni, input.dataFim);
  a.click();
  URL.revokeObjectURL(url);
}
