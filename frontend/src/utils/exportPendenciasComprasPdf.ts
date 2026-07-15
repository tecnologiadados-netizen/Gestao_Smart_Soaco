import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type HookData } from 'jspdf-autotable';
import type { PendenciasComprasDestaques } from '../api/pendenciasCompras';
import {
  ESTOQUE_NAO_CONTROLADO_TEXTO,
  ESTOQUE_VERIFICAR_PCP_TEXTO,
} from './pendenciasComprasDestaques';

export type PendenciasComprasPdfRow = {
  codigo: string;
  descricao: string;
  dataEmissao: string;
  dataNecessidade: string;
  solicitacao: string;
  agPag: string;
  pedidoCompra: string;
  estoqueAtual: string;
  dataUltimaEntrada: string;
  estoqueAntesUltimaEntrada: string;
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

const COL_RATIOS = [0.06, 0.245, 0.083, 0.09, 0.078, 0.072, 0.062, 0.115, 0.088, 0.107] as const;
const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };
/** Solicitação, Ag Pag, PC, Estoque Atual — sempre com badge azul (como GradeCelulaModalBtn). */
const COLS_BADGE = new Set([4, 5, 6, 7]);
/** Estoque Antes da Últ. Entrada — texto simples; estilo especial p/ "(Verificar com PCP)" / "Não controlado". */
const COL_ESTOQUE_ANTES = 9;

/** Espaço reservado no rodapé de toda página para "Emitido em / Página". */
const FOOTER_PAGINA_MM = 8;
/** Altura do bloco de legenda (desenhado só na última página). */
const LEGENDA_ALTURA_MM = 18;

type LegendaPdfItem = {
  texto: string;
  cor?: [number, number, number];
  badgeAzul?: boolean;
};

type LegendaPdfBloco = {
  coluna: string;
  itens: LegendaPdfItem[];
};

const LEGENDA_PDF_BLOCOS: LegendaPdfBloco[] = [
  {
    coluna: 'Cód',
    itens: [
      { texto: 'Estoque zerado e possui solicitação', cor: PDF.codigo.zerado_com_sc },
      { texto: 'Estoque zerado e possui Ag Pag (sobrepõe SC)', cor: PDF.codigo.zerado_com_agpag },
      {
        texto: 'Todas as datas de necessidade superiores a 40 dias',
        cor: PDF.codigo.necessidade_acima_40d,
      },
    ],
  },
  {
    coluna: 'Ag Pag',
    itens: [
      { texto: 'Ag Pag com menos de 24h', cor: PDF.agPag.menos_24h },
      { texto: 'Ag Pag com 24h ou mais', cor: PDF.agPag.mais_24h },
    ],
  },
  {
    coluna: 'PC',
    itens: [
      { texto: 'PC com data de entrega superior à necessidade da SC', cor: PDF.pc.atrasado },
      { texto: 'PC em dia', cor: PDF.pc.em_dia },
    ],
  },
  {
    coluna: 'Estoque Atual',
    itens: [
      {
        texto: 'Estoque padrão Galpão Bobina ou Matéria Prima Processada',
        badgeAzul: true,
      },
      {
        texto: 'Demais estoques padrão (não controlado)',
        badgeAzul: false,
      },
    ],
  },
];

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
  const isNaoControlado = texto === ESTOQUE_NAO_CONTROLADO_TEXTO;

  if (isNaoControlado) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(texto, x + width / 2, y + height / 2, {
      align: 'center',
      baseline: 'middle',
    });
    return;
  }

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

/** Cabeçalho compacto — inspirado no modelo de compras, sem ocupar muito espaço. */
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

/** Texto explicativo do critério de inclusão no relatório. */
const REGRAS_RELATORIO_TEXTO =
  'Só entram no relatório produtos que possuem solicitação de compra em aberto ou solicitações de pagamento (Ag Pag) em aberto.';

function desenharCabecalhoPendenciasPdf(
  doc: jsPDF,
  pageW: number,
  nomeComprador: string,
  emitidoEmStr: string,
  totalProdutos: number
): number {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  const contentW = right - left;

  const blockTop = 8.8;
  const colGap = 5;
  const col1W = contentW * 0.3;
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
  doc.text('RELATÓRIO DE PENDÊNCIAS DO SETOR DE COMPRAS', col1X, blockTop + 1.8);

  const labelY = blockTop + 6.2;
  const nomeY = labelY + 3.4;
  const logsLine2Y = labelY + 3.4;
  const logsLine3Y = labelY + 6.4;

  desenharIconePessoa(doc, col1X, labelY + 0.35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.muted);
  doc.text('Comprador(a)', col1X + 3.2, labelY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.text);
  doc.text(nomeComprador, col1X + 3.2, nomeY);

  desenharIconeImpressora(doc, col2X, labelY + 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('LOGS DE IMPRESSÃO', col2X + 3.2, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr}`, col2X + 3.2, logsLine2Y);
  doc.text(`Total de produtos: ${totalProdutos}`, col2X + 3.2, logsLine3Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('REGRAS DO RELATÓRIO', col3X, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...PDF.muted);
  const regrasLinhas = doc.splitTextToSize(REGRAS_RELATORIO_TEXTO, col3W - 0.5) as string[];
  const regrasLineH = 2.8;
  regrasLinhas.forEach((linha, i) => {
    doc.text(linha, col3X, labelY + 3.2 + i * regrasLineH);
  });

  const regrasBottomY = labelY + 3.2 + regrasLinhas.length * regrasLineH;
  const sepTop = labelY - 1.1;
  const sepBottom = Math.max(logsLine3Y, nomeY, regrasBottomY) + 0.8;

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

function desenharAmostraLegenda(
  doc: jsPDF,
  x: number,
  y: number,
  item: LegendaPdfItem
): void {
  const swatchW = 3;
  const swatchH = 2;
  if (item.badgeAzul) {
    doc.setFillColor(...PDF.primary600);
    doc.roundedRect(x, y - swatchH + 0.15, 5, swatchH, 0.35, 0.35, 'F');
    return;
  }
  if (item.cor) {
    doc.setFillColor(...item.cor);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.1);
    doc.rect(x, y - swatchH + 0.15, swatchW, swatchH, 'FD');
  }
}

function desenharRodapePaginacao(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  emitidoEmStr: string,
  pageNumber: number
): void {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${emitidoEmStr}`, left, pageH - 3.5);
  doc.text(`Página ${pageNumber}`, right, pageH - 3.5, { align: 'right' });
}

function desenharLegendaPdf(doc: jsPDF, pageW: number, legendTop: number): void {
  const left = MARGIN.left;
  const right = pageW - MARGIN.right;
  const largura = right - left;
  const gap = 2;
  const blocoW = (largura - gap * (LEGENDA_PDF_BLOCOS.length - 1)) / LEGENDA_PDF_BLOCOS.length;
  const itemLineH = 2.5;

  doc.setDrawColor(...PDF.rowBorder);
  doc.setLineWidth(0.2);
  doc.line(left, legendTop - 1.2, right, legendTop - 1.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('Legenda', left, legendTop);

  LEGENDA_PDF_BLOCOS.forEach((bloco, blocoIdx) => {
    const blocoX = left + blocoIdx * (blocoW + gap);
    const tituloY = legendTop + 2.8;
    let itemY = tituloY + 3.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...PDF.primary600);
    doc.text(bloco.coluna, blocoX, tituloY);

    bloco.itens.forEach((item) => {
      desenharAmostraLegenda(doc, blocoX, itemY, item);

      const textX = item.badgeAzul ? blocoX + 5.8 : blocoX + 3.8;
      const textW = blocoW - (textX - blocoX) - 0.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...PDF.muted);
      const linhas = doc.splitTextToSize(item.texto, textW) as string[];
      linhas.forEach((linha, li) => {
        doc.text(linha, textX, itemY + li * itemLineH);
      });

      itemY += Math.max(3.2, linhas.length * itemLineH + 0.8);
    });

    if (blocoIdx > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(blocoX - gap / 2, tituloY - 1.5, blocoX - gap / 2, itemY);
    }
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

  const tableStartY = desenharCabecalhoPendenciasPdf(
    doc,
    pageW,
    nomeComprador,
    emitidoEmStr,
    linhas.length
  );

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
      'Últ. Entrada',
      'Estoque Antes da Entrada',
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
    r.dataUltimaEntrada,
    r.estoqueAntesUltimaEntrada,
  ]);

  autoTable(doc, {
    startY: tableStartY,
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
      8: { cellWidth: colWidths[8], halign: 'center' },
      9: { cellWidth: colWidths[9], halign: 'center' },
    },
    margin: { ...MARGIN, bottom: FOOTER_PAGINA_MM },
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

      if (data.column.index === COL_ESTOQUE_ANTES) {
        const texto = linha.estoqueAntesUltimaEntrada.trim();
        if (texto === ESTOQUE_VERIFICAR_PCP_TEXTO || texto === ESTOQUE_NAO_CONTROLADO_TEXTO) {
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.fontSize = 6.5;
          data.cell.styles.textColor = PDF.muted;
        }
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
      desenharRodapePaginacao(doc, pageW, pageH, emitidoEmStr, data.pageNumber);
    },
  });

  const pageH = doc.internal.pageSize.getHeight();
  const finalY = (doc.lastAutoTable?.finalY ?? tableStartY) as number;
  const legendTopUltimaPagina = pageH - FOOTER_PAGINA_MM - LEGENDA_ALTURA_MM;

  if (finalY <= legendTopUltimaPagina - 4) {
    desenharLegendaPdf(doc, pageW, legendTopUltimaPagina);
  } else {
    doc.addPage();
    desenharRodapePaginacao(doc, pageW, pageH, emitidoEmStr, doc.getNumberOfPages());
    desenharLegendaPdf(doc, pageW, MARGIN.top + 6);
  }

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
