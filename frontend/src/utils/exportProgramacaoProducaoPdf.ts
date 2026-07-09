import { jsPDF } from 'jspdf';
import autoTable, { type HookData } from 'jspdf-autotable';
import type { LinhaProgramacaoProducao, ProgramacaoProducaoRecurso } from '../components/programacao-producao/types';
import { formatNum } from '../components/programacao-producao/programacaoProducaoCalculos';
import { ordenarLinhasParaPdf } from './programacaoProducaoValidacoes';
import {
  migrarQtdeProduzirLegado,
  roteirosParaTipoImpressao,
  textoSequenciaRoteiroPdf,
  type TipoImpressaoProgramacaoProducao,
} from './programacaoProducaoRoteiros';
import {
  aplicarCatalogoProgramacaoProducao,
  getCatalogoMedidasPecaRuntime,
  getCatalogoRecursosRuntime,
  patchCatalogoRecursosRuntime,
} from './programacaoProducaoCatalogoRuntime';
import { fetchProgramacaoProducaoCatalogo, listProgramacaoProducaoRecursos } from '../api/programacaoProducao';
import { medidasPecaDoCatalogo } from './programacaoProducaoMedidasPeca';

export type DownloadProgramacaoProducaoPdfOpts = {
  codigoProgramacao: string;
  dataCriacao: string;
  responsavel: string;
  linhas: LinhaProgramacaoProducao[];
  tipoImpressao: TipoImpressaoProgramacaoProducao;
  logoBase64?: string | null;
  recursos?: ProgramacaoProducaoRecurso[];
};

type CellDef = string | { content: string; rowSpan?: number };

type PdfRowMeta = {
  qtde: string;
  med1: string;
  med2: string;
};

/** Mesma paleta do relatório de pendências de compras. */
const PDF = {
  primary600: [30, 34, 170] as [number, number, number],
  primary500: [42, 56, 204] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  rowBorder: [203, 213, 225] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
} as const;

const MARGIN = { left: 8, right: 8, bottom: 10, top: 8 };
const FOOTER_PAGINA_MM = 8;
const COL_RATIOS = [0.05, 0.08, 0.14, 0.18, 0.07, 0.07, 0.07, 0.1, 0.24] as const;
/** Qtde a produzir, Med 1, Med 2 — badge azul. */
const COLS_BADGE = new Set([4, 5, 6]);

const TITULO_TIPO: Record<TipoImpressaoProgramacaoProducao, string> = {
  manual: 'MANUAL',
  perfiladeira: 'PERFILADEIRA',
};

function formatDataBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function textoMedidaPdf(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val) || val <= 0) return '—';
  return `${formatNum(val)} mm`;
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

function desenharBadgeCelula(doc: jsPDF, data: HookData, texto: string): void {
  const { x, y, width, height } = data.cell;
  const fontSize = 8;
  doc.setFont('helvetica', 'bold');
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

function desenharCabecalhoProgramacaoPdf(
  doc: jsPDF,
  pageW: number,
  opts: {
    tipoImpressao: TipoImpressaoProgramacaoProducao;
    codigoProgramacao: string;
    dataCriacao: string;
    responsavel: string;
    emitidoEmStr: string;
    totalLinhas: number;
    logoBase64?: string | null;
  }
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
  const col2W = contentW * 0.28;
  const col3W = contentW - col1W - col2W - colGap * 2;

  const col1X = left;
  const sep1X = col1X + col1W + colGap / 2;
  const col2X = sep1X + colGap / 2;
  const sep2X = col2X + col2W + colGap / 2;
  const col3X = sep2X + colGap / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(...PDF.primary600);
  const titulo = `RELATÓRIO DE PROGRAMAÇÃO DE PRODUÇÃO — ${TITULO_TIPO[opts.tipoImpressao]}`;
  doc.text(titulo, textoInicioX, titleBaselineY);

  const metadataTop = headerTop + logoH + 5.5;
  const labelY = metadataTop + 1.2;
  const valorY = labelY + 3.4;
  const logsLine3Y = labelY + 6.4;
  const progLine4Y = labelY + 6.4;

  desenharIconePessoa(doc, col1X, labelY + 0.35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.muted);
  doc.text('Responsável', col1X + 3.2, labelY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.text);
  doc.text(opts.responsavel, col1X + 3.2, valorY);

  desenharIconeImpressora(doc, col2X, labelY + 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('LOGS DE IMPRESSÃO', col2X + 3.2, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(`Emitido em: ${opts.emitidoEmStr}`, col2X + 3.2, valorY);
  doc.text(`Total de linhas: ${opts.totalLinhas}`, col2X + 3.2, logsLine3Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.text);
  doc.text('PROGRAMAÇÃO', col3X, labelY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF.muted);
  doc.text(`Código: ${opts.codigoProgramacao}`, col3X, valorY);
  doc.text(`Data de criação: ${formatDataBr(opts.dataCriacao)}`, col3X, progLine4Y);

  const sepTop = labelY - 1.1;
  const sepBottom = Math.max(logsLine3Y, valorY, progLine4Y) + 0.8;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(sep1X, sepTop, sep1X, sepBottom);
  doc.line(sep2X, sepTop, sep2X, sepBottom);

  const linhaBaseY = sepBottom + 2;

  doc.setDrawColor(...PDF.primary600);
  doc.setLineWidth(0.35);
  doc.line(left, linhaBaseY, right, linhaBaseY);

  return linhaBaseY + 2.5;
}

function textoBadgeColuna(meta: PdfRowMeta, col: number): string {
  const map: Record<number, string> = {
    4: meta.qtde,
    5: meta.med1,
    6: meta.med2,
  };
  const texto = String(map[col] ?? '').trim();
  if (texto && texto !== '—') return texto;
  return col === 4 ? '0' : '—';
}

function montarTabelaPdf(
  linhas: LinhaProgramacaoProducao[],
  recursos: ProgramacaoProducaoRecurso[],
  tipoImpressao: TipoImpressaoProgramacaoProducao
): { body: CellDef[][]; rowsMeta: PdfRowMeta[]; totalProdutos: number } {
  const body: CellDef[][] = [];
  const rowsMeta: PdfRowMeta[] = [];
  const linhasPdf = ordenarLinhasParaPdf(linhas);
  let totalProdutos = 0;

  for (const l of linhasPdf) {
    const qp = migrarQtdeProduzirLegado(l.qtde_produzir);
    const roteirosFiltrados = roteirosParaTipoImpressao(qp.roteiros, tipoImpressao, recursos);
    if (!roteirosFiltrados.length) continue;

    totalProdutos += 1;
    const medidas = medidasPecaDoCatalogo(l.cod_componente);
    const med1 = textoMedidaPdf(medidas?.med1);
    const med2 = textoMedidaPdf(medidas?.med2);
    const observacao = l.observacao?.trim() || '—';

    const roteiroLinhas = roteirosFiltrados.map((r) => ({
      roteiro: textoSequenciaRoteiroPdf(r.sequencia, recursos),
      qtde: formatNum(r.qtde),
      chapa: r.chapa?.trim() || '—',
    }));

    const n = roteiroLinhas.length;
    const seq = String(l.sequencia);
    const cod = l.cod_componente ?? '—';
    const desc = l.descricao_simplificada?.trim() || '—';

    const meta0: PdfRowMeta = {
      qtde: roteiroLinhas[0]!.qtde,
      med1,
      med2,
    };
    rowsMeta.push(meta0);
    body.push([
      { content: seq, rowSpan: n },
      { content: cod, rowSpan: n },
      { content: desc, rowSpan: n },
      roteiroLinhas[0]!.roteiro,
      roteiroLinhas[0]!.qtde,
      { content: med1, rowSpan: n },
      { content: med2, rowSpan: n },
      roteiroLinhas[0]!.chapa,
      { content: observacao, rowSpan: n },
    ]);

    for (let i = 1; i < n; i++) {
      rowsMeta.push({
        qtde: roteiroLinhas[i]!.qtde,
        med1,
        med2,
      });
      body.push([
        roteiroLinhas[i]!.roteiro,
        roteiroLinhas[i]!.qtde,
        roteiroLinhas[i]!.chapa,
      ]);
    }
  }

  return { body, rowsMeta, totalProdutos };
}

function nomeArquivoPdf(
  codigoProgramacao: string,
  tipoImpressao: TipoImpressaoProgramacaoProducao
): string {
  const safeName = codigoProgramacao.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'programacao';
  return `${safeName}_${tipoImpressao}.pdf`;
}

async function resolverRecursosPdf(
  recursos?: ProgramacaoProducaoRecurso[]
): Promise<ProgramacaoProducaoRecurso[]> {
  if (recursos?.length) return recursos;
  const cached = getCatalogoRecursosRuntime();
  if (cached?.length) return cached;
  const lista = await listProgramacaoProducaoRecursos();
  patchCatalogoRecursosRuntime(lista);
  return lista;
}

async function resolverCatalogoPdf(): Promise<void> {
  if (!getCatalogoMedidasPecaRuntime()) {
    const data = await fetchProgramacaoProducaoCatalogo();
    aplicarCatalogoProgramacaoProducao(data);
  }
}

/** Monta o documento PDF (somente linhas com sequência na tabela). */
export async function buildProgramacaoProducaoPdfDoc(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<jsPDF> {
  const { codigoProgramacao, dataCriacao, responsavel, linhas, logoBase64, tipoImpressao } = opts;
  await resolverCatalogoPdf();
  const recursos = await resolverRecursosPdf(opts.recursos);

  const { body, rowsMeta, totalProdutos } = montarTabelaPdf(linhas, recursos, tipoImpressao);
  if (body.length === 0) {
    throw new Error(
      `Não há linhas com roteiros do tipo "${TITULO_TIPO[tipoImpressao]}" para gerar o PDF.`
    );
  }

  const emitidoEm = new Date();
  const emitidoEmStr = formatarEmitidoEm(emitidoEm);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const tableWidth = pageW - MARGIN.left - MARGIN.right;
  const colWidths = COL_RATIOS.map((r) => tableWidth * r);

  const tableStartY = desenharCabecalhoProgramacaoPdf(doc, pageW, {
    tipoImpressao,
    codigoProgramacao,
    dataCriacao,
    responsavel,
    emitidoEmStr,
    totalLinhas: totalProdutos,
    logoBase64,
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { ...MARGIN, bottom: FOOTER_PAGINA_MM },
    tableWidth,
    head: [
      [
        'Sequência',
        'Código',
        'Desc Simpl',
        'Roteiro',
        'Qtde a produzir',
        'Med 1',
        'Med 2',
        'Chapa',
        'Observação',
      ],
    ],
    body,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      overflow: 'linebreak',
      textColor: PDF.text,
      fillColor: PDF.white,
      lineColor: PDF.rowBorder,
      lineWidth: 0.25,
      valign: 'middle',
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: PDF.primary600,
      textColor: PDF.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 2.8, right: 2, bottom: 2.8, left: 2 },
      lineColor: PDF.primary500,
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'center' },
      1: { cellWidth: colWidths[1], halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: colWidths[2], halign: 'left' },
      3: { cellWidth: colWidths[3], halign: 'left' },
      4: { cellWidth: colWidths[4], halign: 'center' },
      5: { cellWidth: colWidths[5], halign: 'center' },
      6: { cellWidth: colWidths[6], halign: 'center' },
      7: { cellWidth: colWidths[7], halign: 'left' },
      8: { cellWidth: colWidths[8], halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        if ([0, 1, 2, 3, 7, 8].includes(data.column.index)) {
          data.cell.styles.halign = 'left';
        }
        return;
      }
      if (data.section !== 'body') return;

      data.cell.styles.fillColor = PDF.white;

      if (COLS_BADGE.has(data.column.index)) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const meta = rowsMeta[data.row.index];
      if (!meta || !COLS_BADGE.has(data.column.index)) return;

      const texto = textoBadgeColuna(meta, data.column.index);
      if (texto === '—') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF.muted);
        doc.text('—', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      desenharBadgeCelula(doc, data, texto);
    },
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      desenharRodapePaginacao(doc, pageW, pageH, emitidoEmStr, data.pageNumber);
    },
  });

  return doc;
}

export async function gerarProgramacaoProducaoPdfBlob(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<{ blob: Blob; filename: string }> {
  const doc = await buildProgramacaoProducaoPdfDoc(opts);
  const filename = nomeArquivoPdf(opts.codigoProgramacao, opts.tipoImpressao);
  const blob = doc.output('blob');
  return { blob, filename };
}

/** PDF da programação concluída: cabeçalho + grade (somente linhas com sequência). */
export async function downloadProgramacaoProducaoPdf(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<void> {
  const { blob, filename } = await gerarProgramacaoProducaoPdfBlob(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
