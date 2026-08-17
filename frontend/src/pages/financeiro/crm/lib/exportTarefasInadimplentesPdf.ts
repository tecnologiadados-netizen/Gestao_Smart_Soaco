import { jsPDF } from 'jspdf';
import autoTable, { type HookData } from 'jspdf-autotable';
import type { TarefaInadimplente } from '../../../../api/crmFinanceiro';
import { imageUrlToDataUrl } from '../../../../utils/imageDataUrl';
import { isFeriadoReconhecido } from './feriados-nacionais';
import { formatDateWithWeekday, shouldHighlightVencimentoDayLabel } from './formatters';

const LOGO_EMAIL_URL = '/logo-soaco-email.png';

const PDF = {
  primary600: [30, 34, 170] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowBorder: [203, 213, 225] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
} as const;

const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };

const HEAD = [
  'Vencim.',
  'Baixa',
  'Recebim.',
  'Origem',
  'Empresa',
  'Cliente',
  'Conta',
  'Banco',
  'Valor',
  'Atraso',
  'Status',
  'Responsável',
  'NF/PD',
  'Trat.',
] as const;

function formatarEmitidoEm(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return ymd;
}

function moneyBr(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function labelStatus(s: string): string {
  if (s === 'em_contato') return 'Atrasado - Em contato';
  if (s === 'concluida') return 'Concluída';
  return 'Em atraso';
}

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'tarefas'
  );
}

function desenharIconePessoa(doc: jsPDF, x: number, y: number): void {
  const s = 1.15;
  doc.setFillColor(...PDF.primary600);
  doc.circle(x + s, y - s * 0.55, s * 0.42, 'F');
  doc.roundedRect(x + s * 0.25, y - s * 0.05, s * 1.5, s * 1.05, 0.35, 0.35, 'F');
}

function desenharIconeImpressora(doc: jsPDF, x: number, y: number): void {
  const w = 2.4;
  const h = 1.35;
  doc.setFillColor(...PDF.primary600);
  doc.rect(x, y - h, w, h * 0.62, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + w * 0.12, y - h * 0.88, w * 0.76, h * 0.28, 'F');
  doc.setFillColor(...PDF.primary600);
  doc.rect(x + w * 0.18, y - h * 0.35, w * 0.64, h * 0.38, 'F');
}

function desenharRodapePaginacao(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  emitidoEmStr: string,
  pageNumber: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr}`, MARGIN.left, pageH - 3.5);
  doc.text(`Página ${pageNumber}`, pageW - MARGIN.right, pageH - 3.5, { align: 'right' });
}

function linhaPdf(row: TarefaInadimplente): string[] {
  const venc = formatDateWithWeekday(row.vencimento);
  const vencTxt = isFeriadoReconhecido(row.vencimento) ? `${venc}\nFeriado` : venc;
  return [
    vencTxt,
    formatYmd(row.dataBaixa),
    formatYmd(row.pagamento),
    row.origem.toUpperCase(),
    row.empresaNome?.trim() || '—',
    row.clienteNome,
    row.codigoConta,
    row.banco?.trim() || '—',
    moneyBr(row.valor),
    `${row.diasAtraso}d`,
    labelStatus(row.status),
    row.responsavelNome?.trim() || row.responsavelLogin?.trim() || '—',
    row.nfPd?.trim() || '—',
    String(row.contatosCount),
  ];
}

function desenharCabecalho(doc: jsPDF, pageW: number, opts: {
  tituloFila: string;
  responsavel: string;
  emitidoEmStr: string;
  totalLinhas: number;
  totalValor: string;
  logoBase64?: string | null;
}): number {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  const contentW = right - left;
  const logoW = 42;
  const logoH = 14;
  const headerTop = 8;
  const textoInicioX = opts.logoBase64 ? left + logoW + 4 : left;

  if (opts.logoBase64) {
    try {
      doc.addImage(opts.logoBase64, 'PNG', left, headerTop, logoW, logoH);
    } catch {
      /* ignora */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF.primary600);
  doc.text('REGISTRO DE INADIMPLENTES — TAREFAS', textoInicioX, headerTop + logoH * 0.72);

  const metadataTop = headerTop + logoH + 5.5;
  const labelY = metadataTop + 1.2;
  const valorY = labelY + 3.4;
  const line3Y = labelY + 6.4;

  const colGap = 5;
  const col1W = contentW * 0.28;
  const col2W = contentW * 0.38;
  const col1X = left;
  const sep1X = col1X + col1W + colGap / 2;
  const col2X = sep1X + colGap / 2;
  const sep2X = col2X + col2W + colGap / 2;
  const col3X = sep2X + colGap / 2;

  desenharIconePessoa(doc, col1X, labelY + 0.35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.muted);
  doc.text('Responsável', col1X + 3.2, labelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.text);
  doc.text(opts.responsavel || '—', col1X + 3.2, valorY);

  desenharIconeImpressora(doc, col2X, labelY + 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('LOGS DE IMPRESSÃO', col2X + 3.2, labelY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${opts.emitidoEmStr}`, col2X + 3.2, valorY);
  doc.text(`Total de linhas: ${opts.totalLinhas}  ·  ${opts.totalValor}`, col2X + 3.2, line3Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('FILA', col3X, labelY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  const filaLines = doc.splitTextToSize(opts.tituloFila || 'Tarefas', right - col3X);
  doc.text(filaLines, col3X, valorY);

  const sepBottom = Math.max(line3Y, valorY + (filaLines.length - 1) * 3) + 0.8;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(sep1X, labelY - 1.1, sep1X, sepBottom);
  doc.line(sep2X, labelY - 1.1, sep2X, sepBottom);

  const linhaBaseY = sepBottom + 2;
  doc.setDrawColor(...PDF.primary600);
  doc.setLineWidth(0.35);
  doc.line(left, linhaBaseY, right, linhaBaseY);
  return linhaBaseY + 3;
}

export async function downloadTarefasInadimplentesPdf(input: {
  linhas: TarefaInadimplente[];
  tituloFila: string;
  responsavel: string;
}): Promise<void> {
  if (input.linhas.length === 0) {
    throw new Error('Não há linhas visíveis na grade para gerar o PDF.');
  }

  const emitidoEm = new Date();
  const emitidoEmStr = formatarEmitidoEm(emitidoEm);
  const logoBase64 = await imageUrlToDataUrl(LOGO_EMAIL_URL);
  const totalValor = moneyBr(input.linhas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const startY = desenharCabecalho(doc, pageW, {
    tituloFila: input.tituloFila,
    responsavel: input.responsavel,
    emitidoEmStr,
    totalLinhas: input.linhas.length,
    totalValor,
    logoBase64,
  });

  autoTable(doc, {
    startY,
    head: [HEAD as unknown as string[]],
    body: input.linhas.map(linhaPdf),
    foot: [[
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalValor,
      '',
      '',
      '',
      '',
      '',
    ]],
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 5.5,
      cellPadding: 1.1,
      valign: 'middle',
      textColor: PDF.text,
      lineColor: PDF.rowBorder,
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: PDF.primary600,
      textColor: PDF.white,
      fontStyle: 'bold',
      fontSize: 5.5,
      halign: 'center',
      valign: 'middle',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: PDF.text,
      fontStyle: 'bold',
      fontSize: 6,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 },
      8: { halign: 'right' },
      9: { halign: 'right' },
      13: { halign: 'right' },
    },
    margin: { left: MARGIN.left, right: MARGIN.right, bottom: MARGIN.bottom, top: MARGIN.top },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const row = input.linhas[data.row.index];
      if (row && shouldHighlightVencimentoDayLabel(row.vencimento)) {
        data.cell.styles.textColor = PDF.orange;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data: HookData) => {
      desenharRodapePaginacao(doc, pageW, pageH, emitidoEmStr, data.pageNumber);
    },
  });

  const stamp = emitidoEm.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`inadimplentes-tarefas-${slugify(input.tituloFila)}-${stamp}.pdf`);
}
