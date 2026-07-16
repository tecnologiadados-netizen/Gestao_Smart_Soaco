/**
 * Estilos padrão da planilha Orgânico — Manual da Marca Só Aço.
 * Usado quando o arquivo modelo-organico.xlsx não está disponível em /public.
 */
import type ExcelJS from "exceljs";
import { NUMFMT_MOEDA_BR } from "./organico-excel-schema";
import { ORGANICO_HEADERS } from "./organico-headers";

/** Cores da identidade visual (ARGB para ExcelJS) — alinhado ao modelo oficial. */
export const SO_ACO_EXCEL_CORES = {
  navy: "FF002060",
  blue: "FF1E22AA",
  gold: "FFFFAD00",
  gray: "FF808080",
  ink: "FF000000",
  white: "FFFFFFFF",
  page: "FFF4F6FA",
  zebra: "FFE8ECF4",
} as const;

export type ModeloMoedaStyle = {
  numFmt: string;
  alignment?: Partial<ExcelJS.Alignment>;
};

export type ModeloCellStyle = {
  fill?: ExcelJS.Fill;
  font?: Partial<ExcelJS.Font>;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
};

export type ModeloExportStyle = {
  moeda: ModeloMoedaStyle;
  headerHeight: number;
  columnWidths: number[];
  headerStyles: ModeloCellStyle[];
  dataStyles: ModeloCellStyle[];
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function cloneCellStyle(style: ModeloCellStyle): ModeloCellStyle {
  return JSON.parse(JSON.stringify(style)) as ModeloCellStyle;
}

const HEADER_STYLE: ModeloCellStyle = {
  font: {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: SO_ACO_EXCEL_CORES.white },
  },
  fill: solidFill(SO_ACO_EXCEL_CORES.navy),
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  border: {
    top: { style: "thin", color: { argb: SO_ACO_EXCEL_CORES.navy } },
    bottom: { style: "thin", color: { argb: SO_ACO_EXCEL_CORES.navy } },
    left: { style: "thin", color: { argb: SO_ACO_EXCEL_CORES.gray } },
    right: { style: "thin", color: { argb: SO_ACO_EXCEL_CORES.gray } },
  },
};

const DATA_STYLE: ModeloCellStyle = {
  font: {
    name: "Calibri",
    size: 11,
    color: { argb: SO_ACO_EXCEL_CORES.ink },
  },
  fill: solidFill(SO_ACO_EXCEL_CORES.white),
  alignment: { vertical: "middle", wrapText: true },
  border: {
    bottom: { style: "hair", color: { argb: SO_ACO_EXCEL_CORES.gray } },
    left: { style: "hair", color: { argb: SO_ACO_EXCEL_CORES.gray } },
    right: { style: "hair", color: { argb: SO_ACO_EXCEL_CORES.gray } },
  },
};

function defaultColumnWidth(header: string): number {
  const len = header.length;
  if (len <= 8) return 12;
  if (len <= 15) return 16;
  if (len <= 25) return 20;
  return 24;
}

/** Estilos parametrizados Só Aço para exportação do Orgânico. */
export function createDefaultModeloExportStyle(): ModeloExportStyle {
  return {
    moeda: {
      numFmt: NUMFMT_MOEDA_BR,
      alignment: { horizontal: "right", vertical: "middle" },
    },
    headerHeight: 14.25,
    columnWidths: ORGANICO_HEADERS.map(defaultColumnWidth),
    headerStyles: ORGANICO_HEADERS.map(() => cloneCellStyle(HEADER_STYLE)),
    dataStyles: ORGANICO_HEADERS.map(() => cloneCellStyle(DATA_STYLE)),
  };
}
