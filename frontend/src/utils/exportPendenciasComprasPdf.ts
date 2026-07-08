import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type HookData } from 'jspdf-autotable';
import type { PendenciasComprasDestaques } from '../api/pendenciasCompras';
import { ESTOQUE_VERIFICAR_PCP_TEXTO } from './pendenciasComprasDestaques';

export type PendenciasComprasPdfRow = {
  codigo: string;
  descricao: string;
  dataEmissao: string;
  dataNecessidade: string;
  solicitacao: string;
  agPag: string;
  pedidoCompra: string;
  estoqueAtual: string;
  destaques: PendenciasComprasDestaques;
};

export type DownloadPendenciasComprasPdfOpts = {
  comprador: string;
  linhas: PendenciasComprasPdfRow[];
  emitidoEm?: Date;
};

/** Cores primary do Tailwind (bg-primary-600 / border-primary-500) — igual GradeCelulaModalBtn. */
const PDF = {
  primary600: [30, 34, 170] as [number, number, number],
  primary500: [42, 56, 204] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowBorder: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  codigo: {
    zerado_com_sc: [254, 243, 199] as [number, number, number],
    zerado_com_agpag: [254, 215, 170] as [number, number, number],
    necessidade_acima_40d: [226, 232, 240] as [number, number, number],
  },
  agPag: {
    menos_24h: [209, 250, 229] as [number, number, number],
    mais_24h: [254, 243, 199] as [number, number, number],
  },
  pc: {
    atrasado: [254, 226, 226] as [number, number, number],
    em_dia: [209, 250, 229] as [number, number, number],
  },
} as const;

const COL_RATIOS = [0.065, 0.34, 0.095, 0.105, 0.09, 0.08, 0.08, 0.145] as const;
const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };
/** Solicitação, Ag Pag, PC, Estoque Atual — sempre com badge azul (como GradeCelulaModalBtn). */
const COLS_BADGE = new Set([4, 5, 6, 7]);

/** Nome completo no PDF (rótulo Nomus → nome para exibição). */
const NOME_COMPRADOR_PDF: Record<string, string> = {
  'Comprador 1': 'Marcilia Brito da Rocha',
  'Comprador 2': 'Fernanda Soares Oliveira',
  'Comprador 3': 'Barbara Quelly Morais',
};

export function nomeExibicaoCompradorPdf(comprador: string): string {
  const chave = comprador.trim();
  return NOME_COMPRADOR_PDF[chave] ?? chave;
}

/** Tempo mínimo com overlay de geração visível (fluidez da animação). */
export const PAUSA_MINIMA_GERACAO_PDF_MS = 3000;

function aguardarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function textoBadgeColuna(linha: PendenciasComprasPdfRow, col: number): string {
  const map: Record<number, string> = {
    4: linha.solicitacao,
    5: linha.agPag,
    6: linha.pedidoCompra,
    7: linha.estoqueAtual,
  };
  const texto = String(map[col] ?? '').trim();
  if (texto) return texto;
  return '0';
}

function aplicarFundoCelula(data: CellHookData, linha: PendenciasComprasPdfRow): void {
  if (data.section !== 'body') return;

  const col = data.column.index;
  const dest = linha.destaques;

  data.cell.styles.fillColor = PDF.white;

  if (col === 0 && dest.codigo) {
    data.cell.styles.fillColor = PDF.codigo[dest.codigo];
    return;
  }
  if (col === 5 && dest.agPag) {
    data.cell.styles.fillColor = PDF.agPag[dest.agPag];
    return;
  }
  if (col === 6 && dest.pc) {
    data.cell.styles.fillColor = PDF.pc[dest.pc];
  }
}

/** Badge azul compacto centralizado — texto maior, fundo justo ao conteúdo. */
function desenharBadgeCelula(doc: jsPDF, data: HookData, texto: string): void {
  const { x, y, width, height } = data.cell;
  const isVerificarPcp = texto === ESTOQUE_VERIFICAR_PCP_TEXTO;
  const fontSize = isVerificarPcp ? 6.5 : 9;
  const fontStyle = isVerificarPcp ? 'italic' : 'bold';

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);
  const textW = doc.getTextWidth(texto);

  const padX = 2.2;
  const padY = 1.1;
  const badgeW = Math.min(width - 2, textW + padX * 2);
  const badgeH = fontSize * 0.38 + padY * 2;
  const badgeX = x + (width - badgeW) / 2;
  const badgeY = y + (height - badgeH) / 2;

  doc.setFillColor(...PDF.primary600);
  doc.setDrawColor(...PDF.primary500);
  doc.setLineWidth(0.15);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'FD');

  doc.setTextColor(255, 255, 255);
  doc.text(texto, x + width / 2, badgeY + badgeH / 2 + fontSize * 0.08, {
    align: 'center',
    baseline: 'middle',
  });
}

export async function downloadPendenciasComprasPdf(
  opts: DownloadPendenciasComprasPdfOpts
): Promise<void> {
  const inicio = performance.now();

  const { comprador, linhas } = opts;
  const emitidoEm = opts.emitidoEm ?? new Date();
  const emitidoEmStr = formatarEmitidoEm(emitidoEm);
  const nomeComprador = nomeExibicaoCompradorPdf(comprador);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const tableWidth = pageW - MARGIN.left - MARGIN.right;
  const colWidths = COL_RATIOS.map((r) => tableWidth * r);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...PDF.primary600);
  doc.text(nomeComprador, MARGIN.left, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr} · ${linhas.length} produto(s)`, MARGIN.left, 17);

  const head = [
    [
      'Cód',
      'Descrição',
      'Emissão da SC',
      'Necessidade da SC',
      'Solicitação',
      'Ag Pag',
      'PC',
      'Estoque Atual',
    ],
  ];

  const body = linhas.map((r) => [
    r.codigo,
    r.descricao,
    r.dataEmissao,
    r.dataNecessidade,
    r.solicitacao,
    r.agPag,
    r.pedidoCompra,
    r.estoqueAtual,
  ]);

  autoTable(doc, {
    startY: 21,
    head,
    body,
    tableWidth,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      overflow: 'linebreak',
      textColor: PDF.text,
      fillColor: PDF.white,
      lineColor: PDF.rowBorder,
      lineWidth: 0.15,
      valign: 'middle',
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: PDF.primary600,
      textColor: PDF.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 2.8, right: 2, bottom: 2.8, left: 2 },
      lineColor: PDF.primary500,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: colWidths[1], halign: 'left' },
      2: { cellWidth: colWidths[2], halign: 'center' },
      3: { cellWidth: colWidths[3], halign: 'center' },
      4: { cellWidth: colWidths[4], halign: 'center' },
      5: { cellWidth: colWidths[5], halign: 'center' },
      6: { cellWidth: colWidths[6], halign: 'center' },
      7: { cellWidth: colWidths[7], halign: 'center' },
    },
    margin: MARGIN,
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 0 || data.column.index === 1) {
          data.cell.styles.halign = 'left';
        }
        return;
      }
      if (data.section !== 'body') return;

      const linha = linhas[data.row.index];
      if (!linha) return;

      aplicarFundoCelula(data, linha);

      if (COLS_BADGE.has(data.column.index)) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const linha = linhas[data.row.index];
      if (!linha || !COLS_BADGE.has(data.column.index)) return;

      desenharBadgeCelula(doc, data, textoBadgeColuna(linha, data.column.index));
    },
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...PDF.muted);
      doc.text(`Emitido em: ${emitidoEmStr}`, MARGIN.left, pageH - 4);
      doc.text(`Página ${data.pageNumber}`, pageW - MARGIN.right, pageH - 4, {
        align: 'right',
      });
    },
  });

  const slug =
    nomeComprador
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40) || 'pendencias-compras';

  const stamp = emitidoEm.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`pendencias-compras-${slug}-${stamp}.pdf`);

  const restante = PAUSA_MINIMA_GERACAO_PDF_MS - (performance.now() - inicio);
  if (restante > 0) await aguardarMs(restante);
}
