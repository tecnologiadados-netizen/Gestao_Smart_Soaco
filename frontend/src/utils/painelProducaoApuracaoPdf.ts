import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PainelProducaoApuracaoRow } from '../api/painelProducao';

/** Cores primary — mesmo padrão do PDF de pendências de compras. */
const PDF = {
  primary600: [30, 34, 170] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowBorder: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  zebra: [248, 250, 252] as [number, number, number],
};

const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };
/** Larguras proporcionais — tabela ocupa a largura útil (igual compras). */
const COL_RATIOS = [0.22, 0.16, 0.16, 0.18, 0.14, 0.14] as const;

function formatNumero(valor: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(valor);
}

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function slugArquivo(texto: string): string {
  return (
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 50) || 'apuracao'
  );
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

function desenharIconeCalendario(doc: jsPDF, x: number, y: number): void {
  doc.setFillColor(...PDF.primary600);
  doc.setDrawColor(...PDF.primary600);
  doc.roundedRect(x, y - 2.2, 2.6, 2.4, 0.3, 0.3, 'FD');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + 0.35, y - 1.55, 1.9, 1.35, 'F');
  doc.setFillColor(...PDF.primary600);
  doc.rect(x + 0.55, y - 2.35, 0.35, 0.7, 'F');
  doc.rect(x + 1.7, y - 2.35, 0.35, 0.7, 'F');
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

function desenharCabecalhoApuracaoPdf(
  doc: jsPDF,
  pageW: number,
  mesLabel: string,
  areaLabel: string,
  emitidoEmStr: string,
  totalSetores: number,
): number {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  const contentW = right - left;

  const blockTop = 8.8;
  const colGap = 5;
  const col1W = contentW * 0.34;
  const col2W = contentW * 0.28;
  const col3W = contentW - col1W - col2W - colGap * 2;

  const col1X = left;
  const sep1X = col1X + col1W + colGap / 2;
  const col2X = sep1X + colGap / 2;
  const sep2X = col2X + col2W + colGap / 2;
  const col3X = sep2X + colGap / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF.primary600);
  doc.text('APURAÇÃO DE METAS', col1X, blockTop + 1.8);

  const labelY = blockTop + 6.2;
  const valorY = labelY + 3.4;

  desenharIconeCalendario(doc, col1X, labelY + 0.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.muted);
  doc.text('Período / Área', col1X + 3.2, labelY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.text);
  doc.text(`${mesLabel} · ${areaLabel}`, col1X + 3.2, valorY);

  desenharIconeImpressora(doc, col2X, labelY + 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('LOGS DE IMPRESSÃO', col2X + 3.2, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr}`, col2X + 3.2, labelY + 3.4);
  doc.text(`Total de setores: ${totalSetores}`, col2X + 3.2, labelY + 6.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('CONTEÚDO DO RELATÓRIO', col3X, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...PDF.muted);
  const regras =
    'Recorte da validação: meta quantitativa, realizado, atingimento quantitativo, meta atingida e valor a pagar.';
  const regrasLinhas = doc.splitTextToSize(regras, col3W - 0.5) as string[];
  const regrasLineH = 2.8;
  regrasLinhas.forEach((linha, i) => {
    doc.text(linha, col3X, labelY + 3.2 + i * regrasLineH);
  });

  const regrasBottomY = labelY + 3.2 + regrasLinhas.length * regrasLineH;
  const sepTop = labelY - 1.1;
  const sepBottom = Math.max(labelY + 6.4, valorY, regrasBottomY) + 0.8;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(sep1X, sepTop, sep1X, sepBottom);
  doc.line(sep2X, sepTop, sep2X, sepBottom);

  const linhaBaseY = sepBottom + 1.5;
  doc.setDrawColor(...PDF.primary600);
  doc.setLineWidth(0.35);
  doc.line(left, linhaBaseY, right, linhaBaseY);

  return linhaBaseY + 2.5;
}

function desenharRodape(
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

export type ExportarApuracaoPdfOpts = {
  mes: string;
  mesLabel: string;
  areaLabel: string;
  rows: PainelProducaoApuracaoRow[];
};

/**
 * PDF no padrão visual da rotina de compras: cabeçalho em 3 colunas,
 * tabela em largura útil e tipografia legível.
 */
export async function exportarApuracaoMetasPdf(opts: ExportarApuracaoPdfOpts): Promise<void> {
  const { mes, mesLabel, areaLabel, rows } = opts;
  if (rows.length === 0) {
    throw new Error('Não há linhas para imprimir.');
  }

  const emitidoEm = new Date();
  const emitidoEmStr = formatarEmitidoEm(emitidoEm);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const tableWidth = pageW - MARGIN.left - MARGIN.right;
  const colWidths = COL_RATIOS.map((r) => tableWidth * r);

  const tableStartY = desenharCabecalhoApuracaoPdf(
    doc,
    pageW,
    mesLabel,
    areaLabel,
    emitidoEmStr,
    rows.length,
  );

  const head = [
    [
      'Setor',
      'Meta quantitativa',
      'Realizado',
      'Atingimento quantitativo',
      'Meta atingida',
      'Valor a pagar',
    ],
  ];

  const body = rows.map((row) => {
    const unidade = row.unidade || 'un';
    return [
      row.setor,
      `${formatNumero(row.meta_quantitativa)} ${unidade}`,
      `${formatNumero(row.producao_realizada)} ${unidade}`,
      `${formatNumero(row.percentual_meta_quantitativa)}%`,
      row.meta_atingida || '—',
      formatMoeda(row.valor_a_pagar),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    tableWidth,
    margin: { left: MARGIN.left, right: MARGIN.right, bottom: MARGIN.bottom },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2.2, right: 2.2 },
      valign: 'middle',
      textColor: PDF.text,
      lineColor: PDF.rowBorder,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: PDF.primary600,
      textColor: PDF.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 3, bottom: 3, left: 2.2, right: 2.2 },
    },
    bodyStyles: {
      fillColor: PDF.white,
    },
    alternateRowStyles: {
      fillColor: PDF.zebra,
    },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: colWidths[1], halign: 'center' },
      2: { cellWidth: colWidths[2], halign: 'center' },
      3: { cellWidth: colWidths[3], halign: 'center' },
      4: { cellWidth: colWidths[4], halign: 'center' },
      5: { cellWidth: colWidths[5], halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setDrawColor(...PDF.primary600);
        doc.setLineWidth(0.35);
        doc.line(MARGIN.left, 10, pageW - MARGIN.right, 10);
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    desenharRodape(doc, pageW, pageH, emitidoEmStr, p);
  }

  doc.save(`apuracao-metas-${slugArquivo(areaLabel)}-${slugArquivo(mes)}.pdf`);
}
