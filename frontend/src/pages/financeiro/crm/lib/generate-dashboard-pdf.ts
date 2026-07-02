import { jsPDF } from "jspdf";
import autoTable, { type CellHookData, type UserOptions } from "jspdf-autotable";
import {
  formatCurrency,
  formatDate,
  formatDateWithWeekday,
  formatDiasAteAtrasar,
  formatDiasAtraso,
  formatText,
  isTituloDescontado,
  shouldHighlightVencimentoDayLabel,
} from "../lib/formatters";
import { parseLocalDate } from "../lib/datas-locais";
import { isRecebimentoDesconsideradoPorDiaNaoUtil } from "../lib/atraso-recebimento";
import { LEGENDA_CORES_BAIXADOS } from "../lib/legenda-baixados";
import type {
  ContaFinanceira,
  IndicadorClassificacao,
  IndicadoresResumo,
  Recebimento,
} from "../lib/types";
import type { SaudeClienteResult } from "../lib/saude-cliente";
import { formatValorSecaoIndicador } from "../lib/tituloSecaoIndicador";

export type AbaRelatorio = "receber" | "pagar";

export interface DashboardReportInput {
  aba: AbaRelatorio;
  pessoa: string;
  classificacoes: IndicadorClassificacao[];
  totalGeral?: IndicadoresResumo;
  contasAtraso: ContaFinanceira[];
  contasEmDia: ContaFinanceira[];
  baixados: Recebimento[];
  saudeCliente?: SaudeClienteResult;
  saudeClienteImagem?: string;
  saudeClienteImagemWidth?: number;
  saudeClienteImagemHeight?: number;
}

const BAIXADOS_COLUMN_IDS = [
  "codigo",
  "dataEmissao",
  "dataCompetencia",
  "dataVencimento",
  "dataBaixa",
  "dataRecebimento",
  "formaPagamento",
  "contaBancaria",
  "pessoa",
  "descricao",
  "comentariosAgendamento",
  "comentariosLancamento",
  "nfeOrigem",
  "totalDias",
  "valorAteVencimento",
  "valorBaixado",
  "valorRecebido",
  "valorJuros",
] as const;

/** Colunas da tabela de recebimentos/pagamentos no PDF (sem as removidas por espaço). */
const BAIXADOS_PDF_COLUMN_IDS = [
  "dataVencimento",
  "dataRecebimento",
  "formaPagamento",
  "contaBancaria",
  "pessoa",
  "descricao",
  "comentariosAgendamento",
  "comentariosLancamento",
  "nfeOrigem",
  "totalDias",
  "valorAteVencimento",
  "valorBaixado",
  "valorRecebido",
  "valorJuros",
] as const;

const BAIXADOS_PDF_COL_IDX = {
  dataVencimento: 0,
  comentariosAgendamento: 6,
  comentariosLancamento: 7,
  totalDias: 9,
  valorJuros: 13,
} as const;

/** Proporções relativas das colunas de recebimentos/pagamentos no PDF. */
const BAIXADOS_PDF_COLUMN_WIDTHS_MM: readonly number[] = [
  14, // dataVencimento
  11, // dataRecebimento
  10, // formaPagamento
  14, // contaBancaria
  12, // pessoa
  17, // descricao
  9, // comentariosAgendamento
  9, // comentariosLancamento
  9, // nfeOrigem
  8, // totalDias
  16, // valorAteVencimento
  16, // valorBaixado
  14, // valorRecebido
  15, // valorJuros
];

const PDF_TABLE_MARGIN_HORIZONTAL_MM = 8;

function pdfTableContentWidthMm(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - PDF_TABLE_MARGIN_HORIZONTAL_MM * 2;
}

function scaleColumnWidthsToTarget(
  widths: readonly number[],
  targetTotalMm: number,
): number[] {
  const baseSum = widths.reduce((acc, width) => acc + width, 0);
  if (baseSum <= 0) return [...widths];

  const scaled = widths.map(
    (width) => Math.round((width / baseSum) * targetTotalMm * 100) / 100,
  );
  const scaledSum = scaled.reduce((acc, width) => acc + width, 0);
  const drift = Math.round((targetTotalMm - scaledSum) * 100) / 100;
  if (scaled.length > 0 && drift !== 0) {
    scaled[scaled.length - 1] =
      Math.round((scaled[scaled.length - 1]! + drift) * 100) / 100;
  }
  return scaled;
}

function baixadosPdfColumnStyles(doc: jsPDF): NonNullable<UserOptions["columnStyles"]> {
  const widths = scaleColumnWidthsToTarget(
    BAIXADOS_PDF_COLUMN_WIDTHS_MM,
    pdfTableContentWidthMm(doc),
  );
  const styles: NonNullable<UserOptions["columnStyles"]> = {};
  widths.forEach((cellWidth, index) => {
    styles[index] = {
      cellWidth,
      fontSize: 5.5,
      ...(index === BAIXADOS_PDF_COL_IDX.totalDias ? { halign: "center" as const } : {}),
      ...(index >= 10 ? { halign: "right" as const } : {}),
      ...(index === 11 ? { fontStyle: "bold" as const } : {}),
    };
  });
  return styles;
}

const CONTAS_PDF_COL_IDX = {
  comentariosAgendamento: 9,
  comentariosLancamento: 10,
  dias: 11,
  valor: 13,
} as const;

type BaixadosColumnId = (typeof BAIXADOS_COLUMN_IDS)[number];

const COLORS = {
  rowEven: [255, 255, 255] as [number, number, number],
  rowOdd: [232, 238, 247] as [number, number, number],
  rowTotal: [241, 245, 249] as [number, number, number],
  tituloDescontado: [253, 224, 71] as [number, number, number],
  totalDiasNeg: [239, 68, 68] as [number, number, number],
  totalDiasDesconsiderado: [148, 163, 184] as [number, number, number],
  jurosAtencao: [249, 115, 22] as [number, number, number],
  textDark: [15, 23, 42] as [number, number, number],
  textWhite: [255, 255, 255] as [number, number, number],
  textRed: [220, 38, 38] as [number, number, number],
  textGreen: [5, 150, 105] as [number, number, number],
  headerBlue700: [29, 78, 216] as [number, number, number],
  headerBlue600: [37, 99, 235] as [number, number, number],
  headerBlue500: [59, 130, 246] as [number, number, number],
  headerRed: [220, 38, 38] as [number, number, number],
  headerGreen: [5, 150, 105] as [number, number, number],
  headerIndigo: [67, 56, 202] as [number, number, number],
};

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function formatGeradoEm(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "medium",
  }).format(date);
}

function applyZebra(data: CellHookData, totalRowIndex?: number) {
  if (data.section !== "body") return;

  if (totalRowIndex != null && data.row.index === totalRowIndex) {
    data.cell.styles.fillColor = COLORS.rowTotal;
    data.cell.styles.fontStyle = "bold";
    data.cell.styles.textColor = COLORS.textDark;
    return;
  }

  data.cell.styles.fillColor =
    data.row.index % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
}

function baixadosColumnLabels(aba: AbaRelatorio): Record<BaixadosColumnId, string> {
  const dataRecebLabel =
    aba === "receber" ? "Data recebim./fidc" : "Data pagam./fidc";
  const valorRecebLabel =
    aba === "receber" ? "Total Valor recebido" : "Total Valor pago";

  return {
    codigo: "Código",
    dataEmissao: "Data de Emissão NF",
    dataCompetencia: "Competência",
    dataVencimento: "Data vencim.",
    dataBaixa: "Data baixa",
    dataRecebimento: dataRecebLabel,
    formaPagamento: "Forma pagamento",
    contaBancaria: "Conta bancária",
    pessoa: "Pessoa",
    descricao: "Descrição do lançamento",
    comentariosAgendamento: "Comentário Cont. a Receber",
    comentariosLancamento: "Comentário Recebimentos",
    nfeOrigem: "NF-e origem",
    totalDias: "Total de dias",
    valorAteVencimento: "Valor até a data de vencimento",
    valorBaixado: "Valor baixado",
    valorRecebido: valorRecebLabel,
    valorJuros: "Total Juros",
  };
}

function baixadosCellValue(columnId: BaixadosColumnId, row: Recebimento): string {
  switch (columnId) {
    case "codigo":
      return String(row.codigo);
    case "dataEmissao":
      return formatDate(row.dataEmissao);
    case "dataCompetencia":
      return formatDate(row.dataCompetencia);
    case "dataVencimento":
      return formatDateWithWeekday(row.dataVencimento);
    case "dataBaixa":
      return formatDate(row.dataBaixa);
    case "dataRecebimento":
      return formatDate(row.dataRecebimento);
    case "formaPagamento":
      return formatText(row.formaPagamento);
    case "contaBancaria":
      return formatText(row.contaBancaria);
    case "pessoa":
      return formatText(row.pessoa);
    case "descricao":
      return formatText(row.descricao);
    case "comentariosAgendamento":
      return formatText(row.comentariosAgendamento);
    case "comentariosLancamento":
      return formatText(row.comentariosLancamento);
    case "nfeOrigem":
      return formatText(row.nfeOrigem);
    case "totalDias":
      return row.totalDias == null ? "—" : String(row.totalDias);
    case "valorAteVencimento":
      return formatCurrency(row.valorAteVencimento);
    case "valorBaixado":
      return formatCurrency(row.valorBaixado);
    case "valorRecebido":
      return formatCurrency(row.valorRecebido);
    case "valorJuros":
      return formatCurrency(row.valorJuros);
  }
}

function baixadosPdfHeaders(aba: AbaRelatorio): string[] {
  const labels = baixadosColumnLabels(aba);
  return BAIXADOS_PDF_COLUMN_IDS.map((id) => {
    if (id === "dataRecebimento") {
      return aba === "receber" ? "Data recebim." : "Data pagam.";
    }
    if (id === "valorAteVencimento") return "Valor até venc.";
    if (id === "valorBaixado") return "Valor baixado";
    if (id === "valorRecebido") {
      return aba === "receber" ? "Total recebido" : "Total pago";
    }
    if (id === "comentariosAgendamento") {
      return aba === "receber" ? "Com. a Receber" : "Com. a Pagar";
    }
    if (id === "comentariosLancamento") {
      return aba === "receber" ? "Com. Recebim." : "Com. Pagam.";
    }
    if (id === "formaPagamento") return "Forma pag.";
    if (id === "valorJuros") return "Total Juros";
    return labels[id];
  });
}

/** Data + dia abreviado em uma linha (ex.: 05/05/2018 sáb). */
function formatDatePdfVencimento(value: string | null | undefined): string {
  const formatted = formatDate(value);
  if (formatted === "—") return formatted;

  const date = parseLocalDate(value ?? "");
  if (!date) return formatted;

  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(/\.$/, "");
  return `${formatted} ${weekday}`;
}

function baixadosPdfCellValue(
  columnId: BaixadosColumnId,
  row: Recebimento,
): string {
  if (columnId === "dataVencimento") {
    return formatDatePdfVencimento(row.dataVencimento);
  }
  return baixadosCellValue(columnId, row);
}

function baixadosPdfRow(row: Recebimento): string[] {
  return BAIXADOS_PDF_COLUMN_IDS.map((id) => baixadosPdfCellValue(id, row));
}

function contasHeaders(situacao: "atraso" | "emDia"): string[] {
  return [
    "Código",
    "Vencimento",
    "Agendamento",
    "Classificação",
    "Empresa",
    "Conta bancária",
    "Forma pagamento",
    "Pessoa",
    "Descrição do lançamento",
    "Comentário Cont. a Receber",
    "Comentário Recebimentos",
    situacao === "atraso" ? "Dias em atraso" : "Dias até atrasar",
    "NF-e origem",
    "Valor",
  ];
}

function contasRow(row: ContaFinanceira, situacao: "atraso" | "emDia"): string[] {
  const vencimento = formatDate(row.dataVencimento);
  const diasCol =
    situacao === "atraso"
      ? formatDiasAtraso(row.diasAtraso)
      : formatDiasAteAtrasar(row.diasAtraso, row.dataVencimento);

  const classificacao = row.nomeClassificacao
    ? row.classificacao
      ? `${row.nomeClassificacao}\n${row.classificacao}`
      : row.nomeClassificacao
    : "—";

  return [
    String(row.codigo),
    vencimento,
    formatDate(row.dataAgendamento),
    classificacao,
    row.empresa ?? "—",
    row.contaBancaria ?? "—",
    row.formaPagamento ?? "—",
    row.pessoa ?? "—",
    row.descricao ?? "—",
    formatText(row.comentariosAgendamento),
    formatText(row.comentariosLancamento),
    diasCol,
    row.nfeOrigem ?? "—",
    formatCurrency(row.valor),
  ];
}

function indicadoresClassificacaoCell(row: IndicadorClassificacao): string {
  return `${row.nomeClassificacao}\n${row.classificacao}`;
}

function indicadoresValoresRow(row: IndicadoresResumo): string[] {
  return [
    formatCurrency(row.total),
    formatCurrency(row.emAtraso),
    formatCurrency(row.emDia),
    formatCurrency(row.recebido30d),
    formatCurrency(row.recebido90d),
    formatCurrency(row.recebidoAno),
    formatCurrency(row.recebidoHistorico),
  ];
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
}

function addPageFooter(doc: jsPDF, geradoEm: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Gerado em ${geradoEm} · Página ${page} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: "center" },
    );
  }
}

function drawSectionTitle(
  doc: jsPDF,
  y: number,
  title: string,
  subtitle?: string,
  valor?: number,
) {
  const marginX = 8;
  const gap = 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, marginX, y);

  if (valor !== undefined && Number.isFinite(valor)) {
    const valorText = formatValorSecaoIndicador(valor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const padX = 2;
    const textW = doc.getTextWidth(valorText);
    const boxW = textW + padX * 2;
    const boxH = 5;
    const boxX = marginX + titleWidth + gap;
    const boxY = y - 3.6;

    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.25);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, boxY, boxW, boxH, 0.6, 0.6, "FD");
    doc.setTextColor(15, 23, 42);
    doc.text(valorText, boxX + padX, y);
  }

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, marginX, y + 4);
    return y + 8;
  }

  return y + 5;
}

function baseTableStyles(fontSize: number): UserOptions["styles"] {
  return {
    fontSize,
    cellPadding: 0.8,
    overflow: "linebreak",
    valign: "top",
    textColor: COLORS.textDark,
  };
}

function drawPdfDot(
  doc: jsPDF,
  x: number,
  baselineY: number,
  rgb: [number, number, number],
  radius = 0.75,
) {
  doc.setFillColor(...rgb);
  doc.circle(x + radius, baselineY - radius * 0.35, radius, "F");
}

function measureLegendaCoresBaixadosLines(
  doc: jsPDF,
  maxX: number,
  marginX: number,
  fontSize: number,
): number {
  const dotGap = 1.2;
  const itemGap = 2.5;
  let x = marginX;
  let lines = 1;

  doc.setFontSize(fontSize);

  for (let index = 0; index < LEGENDA_CORES_BAIXADOS.length; index += 1) {
    const item = LEGENDA_CORES_BAIXADOS[index];

    if (index > 0) {
      const separatorWidth = doc.getTextWidth("; ");
      if (x + separatorWidth > maxX) {
        x = marginX;
        lines += 1;
      } else {
        x += separatorWidth;
      }
    }

    if (item.tipo === "texto-colorido") {
      doc.setFont("helvetica", "bold");
      const rotuloWidth = doc.getTextWidth(item.rotulo);
      if (x + rotuloWidth > maxX) {
        x = marginX;
        lines += 1;
      }
      x += rotuloWidth + dotGap + dotGap * 2 + 0.4;
      doc.setFont("helvetica", "normal");
      const suffixWidth = doc.getTextWidth(`: ${item.descricao}`);
      if (x + suffixWidth > maxX) {
        x = marginX;
        lines += 1;
      }
      x += suffixWidth + itemGap;
      continue;
    }

    x += dotGap * 2 + 0.4;
    const textWidth = doc.getTextWidth(item.descricao);
    if (x + textWidth > maxX) {
      x = marginX;
      lines += 1;
      x += dotGap * 2 + 0.4 + textWidth + itemGap;
    } else {
      x += textWidth + itemGap;
    }
  }

  return lines;
}

function drawLegendaCoresBaixados(doc: jsPDF, y: number): number {
  const marginX = 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxX = pageWidth - marginX;
  const fontSize = 6.5;
  const lineHeight = 3.6;
  const dotGap = 1.2;
  const itemGap = 2.5;
  const boxPaddingY = 1.8;
  const lines = measureLegendaCoresBaixadosLines(doc, maxX, marginX, fontSize);
  const boxHeight = boxPaddingY * 2 + lines * lineHeight + 0.8;
  const startY = y + boxPaddingY + fontSize * 0.35;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, boxHeight, 1, 1, "FD");

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");

  let x = marginX;
  let lineY = startY;

  LEGENDA_CORES_BAIXADOS.forEach((item, index) => {
    if (index > 0) {
      doc.setTextColor(203, 213, 225);
      const separator = ";";
      const separatorWidth = doc.getTextWidth(`${separator} `);
      if (x + separatorWidth > maxX) {
        x = marginX;
        lineY += lineHeight;
      } else {
        doc.text(`${separator} `, x, lineY);
        x += separatorWidth;
      }
    }

    if (item.tipo === "texto-colorido") {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...item.corRgb);
      const rotuloWidth = doc.getTextWidth(item.rotulo);
      if (x + rotuloWidth > maxX) {
        x = marginX;
        lineY += lineHeight;
      }
      doc.text(item.rotulo, x, lineY);
      x += rotuloWidth + dotGap;
      drawPdfDot(doc, x, lineY, item.corRgb);
      x += dotGap * 2 + 0.4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const suffix = `: ${item.descricao}`;
      const suffixWidth = doc.getTextWidth(suffix);
      if (x + suffixWidth > maxX) {
        x = marginX;
        lineY += lineHeight;
      }
      doc.text(suffix, x, lineY);
      x += suffixWidth + itemGap;
      return;
    }

    drawPdfDot(doc, x, lineY, item.corRgb);
    x += dotGap * 2 + 0.4;
    doc.setTextColor(71, 85, 105);
    const textWidth = doc.getTextWidth(item.descricao);
    if (x + textWidth > maxX) {
      x = marginX;
      lineY += lineHeight;
      drawPdfDot(doc, x, lineY, item.corRgb);
      x += dotGap * 2 + 0.4;
    }
    doc.text(item.descricao, x, lineY);
    x += textWidth + itemGap;
  });

  return y + boxHeight + 2;
}

export function generateDashboardPdf(input: DashboardReportInput): jsPDF {
  const geradoEm = formatGeradoEm(new Date());
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as DocWithTable;

  const abaLabel =
    input.aba === "receber"
      ? "Contas a receber e recebimentos"
      : "Contas a pagar e pagamentos";

  const labelContas =
    input.aba === "receber" ? "Contas a receber" : "Contas a pagar";
  const labelBaixado =
    input.aba === "receber" ? "Recebimentos" : "Pagamentos";

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CRM Financeiro — Relatório", 10, 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Financeiro · ${abaLabel}`, 10, 18);
  doc.text(`Data e hora de geração: ${geradoEm}`, 10, 23);

  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(10, 32, doc.internal.pageSize.getWidth() - 20, 14, 2, 2, "FD");

  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Cliente / Pessoa filtrada:", 14, 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(120, 53, 15);
  doc.text(input.pessoa, 14, 44);

  let cursorY = 52;

  if (input.saudeClienteImagem) {
    const marginX = 10;
    const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let imgHeight: number;

    if (input.saudeClienteImagemWidth && input.saudeClienteImagemHeight) {
      imgHeight =
        (input.saudeClienteImagemHeight * contentWidth) /
        input.saudeClienteImagemWidth;
    } else {
      try {
        const imgProps = doc.getImageProperties(input.saudeClienteImagem);
        imgHeight = (imgProps.height * contentWidth) / imgProps.width;
      } catch {
        imgHeight = contentWidth * 0.28;
      }
    }

    if (cursorY + imgHeight > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      cursorY = 12;
    }

    doc.addImage(
      input.saudeClienteImagem,
      "PNG",
      marginX,
      cursorY,
      contentWidth,
      imgHeight,
    );
    cursorY += imgHeight + 6;
  }

  const runTable = (options: UserOptions) => {
    if (cursorY > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      cursorY = 12;
    }

    autoTable(doc, {
      margin: { left: 8, right: 8, top: 8, bottom: 12 },
      theme: "grid",
      ...options,
      startY: options.startY ?? cursorY,
    });

    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 6;
  };

  const totalIndicadores =
    input.totalGeral ??
    input.classificacoes.reduce<IndicadoresResumo>(
      (acc, row) => ({
        total: acc.total + row.total,
        emAtraso: acc.emAtraso + row.emAtraso,
        emDia: acc.emDia + row.emDia,
        recebido30d: acc.recebido30d + row.recebido30d,
        recebido90d: acc.recebido90d + row.recebido90d,
        recebidoAno: acc.recebidoAno + row.recebidoAno,
        recebidoHistorico: acc.recebidoHistorico + row.recebidoHistorico,
      }),
      {
        total: 0,
        emAtraso: 0,
        emDia: 0,
        recebido30d: 0,
        recebido90d: 0,
        recebidoAno: 0,
        recebidoHistorico: 0,
      },
    );

  const indicadoresBody: string[][] =
    input.classificacoes.length > 0
      ? [
          ...input.classificacoes.map((row) => [
            indicadoresClassificacaoCell(row),
            ...indicadoresValoresRow(row),
          ]),
          ["Total", ...indicadoresValoresRow(totalIndicadores)],
        ]
      : [["Não há registros para exibição", "", "", "", "", "", "", ""]];

  const indicadoresTotalRowIndex =
    input.classificacoes.length > 0 ? input.classificacoes.length : undefined;

  cursorY = drawSectionTitle(doc, cursorY, "Indicadores de desempenho");

  runTable({
    head: [
      [
        {
          content: "Classificação",
          rowSpan: 2,
          styles: {
            halign: "left",
            valign: "middle",
            fillColor: COLORS.headerBlue600,
          },
        },
        {
          content: labelContas,
          colSpan: 3,
          styles: { halign: "center", fillColor: COLORS.headerBlue600 },
        },
        {
          content: labelBaixado,
          colSpan: 4,
          styles: { halign: "center", fillColor: COLORS.headerBlue600 },
        },
      ],
      [
        "Total",
        "Em atraso",
        "A vencer",
        "Últimos 30 dias",
        "Últimos 90 dias",
        "Último ano",
        "Total histórico",
      ],
    ],
    body: indicadoresBody,
    styles: baseTableStyles(7),
    headStyles: {
      fillColor: COLORS.headerBlue500,
      textColor: COLORS.textWhite,
      fontStyle: "bold",
      halign: "right",
      fontSize: 6.5,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 52 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.row.index === 0 && data.column.index === 0) {
        data.cell.styles.fillColor = COLORS.headerBlue600;
        data.cell.styles.halign = "left";
      }

      if (data.section === "body") {
        applyZebra(data, indicadoresTotalRowIndex);

        if (data.column.index === 2) {
          data.cell.styles.textColor = COLORS.textRed;
        }
        if (data.column.index === 3) {
          data.cell.styles.textColor = COLORS.textGreen;
        }
        if (data.column.index >= 1) {
          data.cell.styles.halign = "right";
        }
      }
    },
  });

  const paintContasTable = (
    title: string,
    subtitle: string,
    valorSecao: number,
    rows: ContaFinanceira[],
    headerColor: [number, number, number],
    situacao: "atraso" | "emDia",
  ) => {
    const body =
      rows.length > 0
        ? rows.map((row) => contasRow(row, situacao))
        : [contasHeaders(situacao).map((_, index) =>
            index === 0 ? "Não há registros para exibição" : "",
          )];

    cursorY = drawSectionTitle(doc, cursorY, title, subtitle, valorSecao);

    runTable({
      head: [contasHeaders(situacao)],
      body,
      styles: baseTableStyles(6.5),
      headStyles: {
        fillColor: headerColor,
        textColor: COLORS.textWhite,
        fontStyle: "bold",
        fontSize: 6,
      },
      columnStyles: {
        [CONTAS_PDF_COL_IDX.dias]: { halign: "center", cellWidth: 14 },
        [CONTAS_PDF_COL_IDX.valor]: { halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section !== "body" || rows.length === 0) return;

        const row = rows[data.row.index];
        applyZebra(data);

        if (
          data.column.index === CONTAS_PDF_COL_IDX.comentariosAgendamento &&
          isTituloDescontado(row.comentariosAgendamento)
        ) {
          data.cell.styles.fillColor = COLORS.tituloDescontado;
          data.cell.styles.textColor = COLORS.textDark;
          data.cell.styles.fontStyle = "bold";
        }

        if (
          data.column.index === CONTAS_PDF_COL_IDX.comentariosLancamento &&
          isTituloDescontado(row.comentariosLancamento)
        ) {
          data.cell.styles.fillColor = COLORS.tituloDescontado;
          data.cell.styles.textColor = COLORS.textDark;
          data.cell.styles.fontStyle = "bold";
        }

        if (data.column.index === CONTAS_PDF_COL_IDX.dias) {
          data.cell.styles.halign = "center";

          if (situacao === "atraso" && row.diasAtraso > 0) {
            data.cell.styles.fillColor = COLORS.totalDiasNeg;
            data.cell.styles.textColor = COLORS.textWhite;
            data.cell.styles.fontStyle = "bold";
          }

          if (situacao === "emDia") {
            data.cell.styles.textColor = COLORS.textGreen;
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === CONTAS_PDF_COL_IDX.valor) {
          data.cell.styles.halign = "right";
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  };

  paintContasTable(
    input.aba === "receber"
      ? "Contas a receber em atraso"
      : "Contas a pagar em atraso",
    "Agendamentos com vencimento anterior à data de hoje",
    totalIndicadores.emAtraso,
    input.contasAtraso,
    COLORS.headerRed,
    "atraso",
  );

  paintContasTable(
    input.aba === "receber"
      ? "Contas a vencer"
      : "Contas a pagar a vencer",
    "Agendamentos dentro do prazo ou sem vencimento definido",
    totalIndicadores.emDia,
    input.contasEmDia,
    COLORS.headerGreen,
    "emDia",
  );

  const baixadosExibidos = input.baixados;
  const baixadosBody =
    baixadosExibidos.length > 0
      ? baixadosExibidos.map(baixadosPdfRow)
      : [
          baixadosPdfHeaders(input.aba).map((_, index) =>
            index === 0 ? "Não há registros para exibição" : "—",
          ),
        ];

  cursorY = drawSectionTitle(
    doc,
    cursorY,
    input.aba === "receber" ? "Recebimentos" : "Pagamentos realizados",
    `${baixadosExibidos.length} registro(s) · colunas essenciais para leitura`,
    totalIndicadores.recebidoHistorico,
  );

  cursorY = drawLegendaCoresBaixados(doc, cursorY);

  runTable({
    tableWidth: pdfTableContentWidthMm(doc),
    head: [baixadosPdfHeaders(input.aba)],
    body: baixadosBody,
    styles: {
      ...baseTableStyles(5.5),
      cellPadding: 0.55,
    },
    headStyles: {
      fillColor: COLORS.headerIndigo,
      textColor: COLORS.textWhite,
      fontStyle: "bold",
      fontSize: 5.5,
      cellPadding: 0.6,
    },
    columnStyles: baixadosPdfColumnStyles(doc),
    didParseCell: (data) => {
      if (data.section !== "body" || baixadosExibidos.length === 0) return;

      const row = baixadosExibidos[data.row.index];
      applyZebra(data);

      const isDataOuValor =
        data.column.index === BAIXADOS_PDF_COL_IDX.dataVencimento ||
        data.column.index === 1 ||
        data.column.index >= 10;

      if (isDataOuValor) {
        data.cell.styles.fontSize = 5.5;
        data.cell.styles.cellPadding = 0.55;
      }

      if (
        data.column.index === BAIXADOS_PDF_COL_IDX.dataVencimento ||
        data.column.index === 1
      ) {
        data.cell.styles.halign = "left";
      }

      if (data.column.index >= 10) {
        data.cell.styles.halign = "right";
      }

      if (
        data.column.index === BAIXADOS_PDF_COL_IDX.dataVencimento &&
        shouldHighlightVencimentoDayLabel(row.dataVencimento)
      ) {
        data.cell.styles.textColor = COLORS.jurosAtencao;
        data.cell.styles.fontStyle = "bold";
      }

      if (
        data.column.index === BAIXADOS_PDF_COL_IDX.comentariosAgendamento &&
        isTituloDescontado(row.comentariosAgendamento)
      ) {
        data.cell.styles.fillColor = COLORS.tituloDescontado;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = COLORS.textDark;
      }

      if (
        data.column.index === BAIXADOS_PDF_COL_IDX.comentariosLancamento &&
        isTituloDescontado(row.comentariosLancamento)
      ) {
        data.cell.styles.fillColor = COLORS.tituloDescontado;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = COLORS.textDark;
      }

      if (
        data.column.index === BAIXADOS_PDF_COL_IDX.totalDias &&
        row.totalDias != null
      ) {
        if (isRecebimentoDesconsideradoPorDiaNaoUtil(row)) {
          data.cell.styles.fillColor = COLORS.totalDiasDesconsiderado;
          data.cell.styles.textColor = COLORS.textWhite;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
        } else if (row.totalDias < 0) {
          data.cell.styles.fillColor = COLORS.totalDiasNeg;
          data.cell.styles.textColor = COLORS.textWhite;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
        }
      }

      if (data.column.index === BAIXADOS_PDF_COL_IDX.valorJuros) {
        if (isRecebimentoDesconsideradoPorDiaNaoUtil(row)) {
          data.cell.styles.fillColor = COLORS.totalDiasDesconsiderado;
          data.cell.styles.textColor = COLORS.textWhite;
          data.cell.styles.fontStyle = "bold";
        } else if (
          row.totalDias != null &&
          row.totalDias < 0 &&
          row.valorJuros <= 0
        ) {
          data.cell.styles.fillColor = COLORS.jurosAtencao;
          data.cell.styles.textColor = COLORS.textWhite;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  addPageFooter(doc, geradoEm);
  return doc;
}

export async function downloadDashboardPdf(
  input: DashboardReportInput,
): Promise<void> {
  const doc = generateDashboardPdf(input);
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `relatorio-crm-${slugify(input.pessoa)}-${stamp}.pdf`;
  doc.save(filename);
}
