/**
 * PDF de aprovação do gestor — pendências de crédito.
 * Visual alinhado ao relatório de Programação de Produção (cabeçalho + tabela).
 * Logo: logo-soaco-email.png (letras escuras, mesma dos e-mails de alerta CRM).
 */

import { jsPDF } from 'jspdf';
import autoTable, { type HookData } from 'jspdf-autotable';
import type { PendenciaCreditoItem } from '../../../../api/crmFinanceiro';
import { imageUrlToDataUrl } from '../../../../utils/imageDataUrl';

export type PendenciaAprovacaoPdfRow = {
  clienteNome: string;
  numeroPedidoExibicao: string;
  valorPedido: number | null;
  qtdTitulosAtraso: number | null;
  totalAtraso: number | null;
};

const DECISIONS = [
  { key: 'cancelado', header: 'Cancelado' },
  { key: 'pausado', header: 'Pausado' },
  { key: 'realocar', header: 'Realocar' },
  { key: 'seguir', header: 'Seguir prod.' },
] as const;

/** Mesma paleta do relatório de programação de produção. */
const PDF = {
  primary600: [30, 34, 170] as [number, number, number],
  primary500: [42, 56, 204] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowBorder: [203, 213, 225] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
} as const;

const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };
const LOGO_EMAIL_URL = '/logo-soaco-email.png';
const DECISION_COL_INDEXES = [4, 5, 6, 7];

function formatarBRL(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'pendencias'
  );
}

/** Converte itens da grade em linhas do PDF (1 pedido = 1 linha). */
export function mapPendenciasParaAprovacaoPdf(
  itens: PendenciaCreditoItem[],
): PendenciaAprovacaoPdfRow[] {
  return itens.map((item) => ({
    clienteNome: item.clienteNome?.trim() || '—',
    numeroPedidoExibicao:
      item.numeroPedidoExibicao?.trim() || item.numeroPedido || '—',
    valorPedido: item.valorPedido,
    qtdTitulosAtraso: item.qtdTitulosAtraso,
    totalAtraso: item.totalAtraso,
  }));
}

function textoAtrasoPdf(row: PendenciaAprovacaoPdfRow): string {
  const qtd =
    row.qtdTitulosAtraso != null ? `${row.qtdTitulosAtraso} conta(s)` : '—';
  const valor = formatarBRL(row.totalAtraso);
  return `${qtd}\n${valor}`;
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
  doc.setDrawColor(...PDF.primary600);
  doc.rect(x, y - h, w, h * 0.62, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + w * 0.12, y - h * 0.88, w * 0.76, h * 0.28, 'F');
  doc.setFillColor(...PDF.primary600);
  doc.rect(x + w * 0.18, y - h * 0.35, w * 0.64, h * 0.38, 'F');
}

function drawCheckbox(doc: jsPDF, x: number, y: number, sizeMm = 3.2): void {
  doc.setDrawColor(...PDF.text);
  doc.setLineWidth(0.3);
  doc.rect(x, y, sizeMm, sizeMm);
}

function desenharRodapePaginacao(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  emitidoEmStr: string,
  pageNumber: number,
): void {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr}`, left, pageH - 3.5);
  doc.text(`Página ${pageNumber}`, right, pageH - 3.5, { align: 'right' });
}

function desenharCabecalhoAprovacaoPdf(
  doc: jsPDF,
  pageW: number,
  opts: {
    tituloFila: string;
    responsavel: string;
    emitidoEmStr: string;
    totalLinhas: number;
    logoBase64?: string | null;
  },
): number {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  const contentW = right - left;

  const logoW = 42;
  const logoH = 14;
  const logoX = left;
  const headerTop = 8;
  const logoY = headerTop;
  const textoInicioX = opts.logoBase64 ? logoX + logoW + 4 : left;

  if (opts.logoBase64) {
    try {
      doc.addImage(opts.logoBase64, 'PNG', logoX, logoY, logoW, logoH);
    } catch {
      /* ignora logo inválida */
    }
  }

  const titleFontSize = 9.5;
  const titleBaselineY = headerTop + logoH * 0.72;

  const colGap = 5;
  const col1W = contentW * 0.28;
  const col2W = contentW * 0.36;
  const col3W = contentW - col1W - col2W - colGap * 2;

  const col1X = left;
  const sep1X = col1X + col1W + colGap / 2;
  const col2X = sep1X + colGap / 2;
  const sep2X = col2X + col2W + colGap / 2;
  const col3X = sep2X + colGap / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(...PDF.primary600);
  doc.text('RELATÓRIO DE PENDÊNCIAS DE CRÉDITO — APROVAÇÃO', textoInicioX, titleBaselineY);

  const metadataTop = headerTop + logoH + 5.5;
  const labelY = metadataTop + 1.2;
  const valorY = labelY + 3.4;
  const line3Y = labelY + 6.4;

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
  doc.text(`Total de linhas: ${opts.totalLinhas}`, col2X + 3.2, line3Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('FILA', col3X, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  const filaLines = doc.splitTextToSize(opts.tituloFila || 'Pendências', col3W);
  doc.text(filaLines, col3X, valorY);

  const sepTop = labelY - 1.1;
  const sepBottom = Math.max(line3Y, valorY + (filaLines.length - 1) * 3) + 0.8;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(sep1X, sepTop, sep1X, sepBottom);
  doc.line(sep2X, sepTop, sep2X, sepBottom);

  const linhaBaseY = sepBottom + 2;
  doc.setDrawColor(...PDF.primary600);
  doc.setLineWidth(0.35);
  doc.line(left, linhaBaseY, right, linhaBaseY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(
    'Marque com X a decisão aprovada e assine na coluna à direita.',
    left,
    linhaBaseY + 4,
  );

  return linhaBaseY + 6.5;
}

export async function generatePendenciasAprovacaoPdf(input: {
  linhas: PendenciaAprovacaoPdfRow[];
  tituloFila?: string;
  responsavel?: string;
  logoBase64?: string | null;
}): Promise<jsPDF> {
  const emitidoEm = new Date();
  const emitidoEmStr = formatarEmitidoEm(emitidoEm);
  const logoBase64 =
    input.logoBase64 ?? (await imageUrlToDataUrl(LOGO_EMAIL_URL));

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const startY = desenharCabecalhoAprovacaoPdf(doc, pageW, {
    tituloFila: input.tituloFila ?? 'Pendências',
    responsavel: input.responsavel?.trim() || '—',
    emitidoEmStr,
    totalLinhas: input.linhas.length,
    logoBase64,
  });

  const head = [
    [
      'Cliente',
      'Pedido',
      'Valor',
      'Atraso',
      ...DECISIONS.map((d) => d.header),
      'Assinatura',
    ],
  ];

  const body = input.linhas.map((row) => [
    row.clienteNome,
    row.numeroPedidoExibicao,
    formatarBRL(row.valorPedido),
    textoAtrasoPdf(row),
    '',
    '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.8,
      valign: 'middle',
      textColor: PDF.text,
      lineColor: PDF.rowBorder,
      lineWidth: 0.2,
      overflow: 'linebreak',
      minCellHeight: 9,
    },
    headStyles: {
      fillColor: PDF.primary600,
      textColor: PDF.white,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 52, halign: 'left' },
      1: { cellWidth: 28, halign: 'left' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 24, halign: 'center' },
      8: { minCellHeight: 11 },
    },
    margin: {
      left: MARGIN.left,
      right: MARGIN.right,
      // Reserva espaço no rodapé da última página para o campo de data + paginação
      bottom: MARGIN.bottom + 14,
      top: MARGIN.top,
    },
    didDrawCell: (data: HookData) => {
      if (data.section !== 'body') return;
      if (!DECISION_COL_INDEXES.includes(data.column.index)) return;
      const size = 3.2;
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      drawCheckbox(doc, x, y, size);
    },
    didDrawPage: (data) => {
      desenharRodapePaginacao(doc, pageW, pageH, emitidoEmStr, data.pageNumber);
    },
  });

  desenharCampoDataAssinaturas(doc, pageW, pageH);

  return doc;
}

type DocComTabela = jsPDF & { lastAutoTable?: { finalY: number } };

/**
 * Campo único abaixo da tabela, alinhado à direita.
 * Nunca abre página nova — usa o espaço reservado no rodapé.
 */
function desenharCampoDataAssinaturas(
  doc: jsPDF,
  pageW: number,
  pageH: number,
): void {
  const docT = doc as DocComTabela;
  const yMax = pageH - 8;
  let y = (docT.lastAutoTable?.finalY ?? 40) + 6;
  if (y > yMax) {
    y = yMax;
  }

  const label = 'Data assinaturas: __/___/_____';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF.text);
  doc.text(label, pageW - MARGIN.right, y, { align: 'right' });
}

export async function downloadPendenciasAprovacaoPdf(input: {
  linhas: PendenciaAprovacaoPdfRow[];
  tituloFila?: string;
  responsavel?: string;
}): Promise<void> {
  if (input.linhas.length === 0) {
    throw new Error('Não há pedidos na fila para gerar o PDF.');
  }
  const doc = await generatePendenciasAprovacaoPdf(input);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filaSlug = slugify(input.tituloFila ?? 'aprovacao');
  doc.save(`pendencias-credito-aprovacao-${filaSlug}-${stamp}.pdf`);
}
