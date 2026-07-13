import ExcelJS from "exceljs";
import type { AbsenteismoPorHorasRow } from "./types";

export type DetalheExportFilterLine = { label: string; value: string };

/** Contexto textual gerado na tela (filtros, ordenação, cruzamento). */
export type DetalheExportContext = {
  title?: string;
  /** Linhas ex.: Período, Atraso mínimo, Colaborador… */
  filterLines: DetalheExportFilterLine[];
  /** Descrição legível da ordenação aplicada à tabela. */
  sortDescription: string;
};

const HEADER_LABELS = [
  "DATA",
  "NOME",
  "Turno",
  "ENT. 1",
  "SAÍ. 2",
  "NORMAIS",
  "FALTAS",
  "EXTRAS",
  "Atraso (min)",
] as const;

const HEADER_FILL = "FF1E3A5F";
const HEADER_FONT = "FFFFFFFF";
const ALT_ROW_FILL = "FFF3F4F6";
const BORDER_COLOR = "FFE5E7EB";
const TITLE_FILL = "FFEEF2FF";

function excelDateFromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

/** Hora do dia em fração de dia (Excel). */
function timeFractionFromMinutes(min: number | null | undefined): number | null {
  if (min == null || !Number.isFinite(min)) return null;
  const m = Math.max(0, Math.round(min)) % (24 * 60);
  return m / (24 * 60);
}

/** Duração em minutos como fração de dia (formato [h]:mm). */
function durationFractionFromMinutes(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.round(min) / (24 * 60);
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  };
}

function defaultFilename(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `absenteismo-por-horas-detalhe-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.xlsx`;
}

/**
 * Exporta a tabela de detalhamento por dia com bloco de filtros e formatação corporativa.
 */
export async function exportDetalheAbsenteismoPorHorasExcel(
  rows: AbsenteismoPorHorasRow[],
  ctx: DetalheExportContext,
  filename = defaultFilename(),
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GESTÃO RH SO";
  wb.created = new Date();

  const ws = wb.addWorksheet("Detalhamento");

  const lastColLetter = "I";

  let currentRow = 1;

  const title = ctx.title ?? "Detalhamento por dia — Pontualidade";
  ws.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF111827" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
  titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  titleCell.border = thinBorder();
  ws.getRow(currentRow).height = 28;
  currentRow += 1;

  const gen = new Date();
  const genStr = gen.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  ws.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const sub = ws.getCell(`A${currentRow}`);
  sub.value = `Exportado em ${genStr} · ${rows.length} linha(s)`;
  sub.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  sub.alignment = { vertical: "middle", horizontal: "left" };
  currentRow += 1;

  currentRow += 1;
  ws.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const fl = ws.getCell(`A${currentRow}`);
  fl.value = "Filtros e recorte aplicados";
  fl.font = { bold: true, size: 11, color: { argb: "FF111827" } };
  fl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  fl.border = thinBorder();
  currentRow += 1;

  for (const { label, value } of ctx.filterLines) {
    ws.getCell(`A${currentRow}`).value = label;
    ws.getCell(`A${currentRow}`).font = { bold: true, size: 10 };
    ws.getCell(`A${currentRow}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    ws.getCell(`A${currentRow}`).border = thinBorder();

    ws.mergeCells(`B${currentRow}:${lastColLetter}${currentRow}`);
    ws.getCell(`B${currentRow}`).value = value;
    ws.getCell(`B${currentRow}`).font = { size: 10 };
    ws.getCell(`B${currentRow}`).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    ws.getCell(`B${currentRow}`).border = thinBorder();
    currentRow += 1;
  }

  ws.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const sortCell = ws.getCell(`A${currentRow}`);
  sortCell.value = `Ordenação da tabela: ${ctx.sortDescription}`;
  sortCell.font = { size: 10, italic: true };
  sortCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  sortCell.border = thinBorder();
  currentRow += 1;

  currentRow += 1;

  const headerRowIndex = currentRow;
  const headerRow = ws.getRow(headerRowIndex);
  HEADER_LABELS.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 22;
  currentRow += 1;

  const dataStartRow = currentRow;
  rows.forEach((r, idx) => {
    const row = ws.getRow(dataStartRow + idx);
    const alt = idx % 2 === 1;
    const fill = alt ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: ALT_ROW_FILL } } : undefined;

    const c1 = row.getCell(1);
    const d = excelDateFromIso(r.dataIso);
    c1.value = d ?? r.dataIso;
    if (d) c1.numFmt = "dd/mm/yyyy";
    c1.font = { size: 10 };
    c1.alignment = { vertical: "middle", horizontal: "center" };
    c1.border = thinBorder();
    if (fill) c1.fill = fill;

    const c2 = row.getCell(2);
    c2.value = r.nome;
    c2.font = { size: 10 };
    c2.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    c2.border = thinBorder();
    if (fill) c2.fill = fill;

    const c3 = row.getCell(3);
    c3.value = r.turno || "—";
    c3.font = { size: 10 };
    c3.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c3.border = thinBorder();
    if (fill) c3.fill = fill;

    const ent = timeFractionFromMinutes(r.entradaRealMin);
    const c4 = row.getCell(4);
    if (ent != null) {
      c4.value = ent;
      c4.numFmt = "hh:mm";
    } else {
      c4.value = "—";
    }
    c4.font = { size: 10 };
    c4.alignment = { vertical: "middle", horizontal: "center" };
    c4.border = thinBorder();
    if (fill) c4.fill = fill;

    const sai = timeFractionFromMinutes(r.saidaRealMin);
    const c5 = row.getCell(5);
    if (sai != null) {
      c5.value = sai;
      c5.numFmt = "hh:mm";
    } else {
      c5.value = "—";
    }
    c5.font = { size: 10 };
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.border = thinBorder();
    if (fill) c5.fill = fill;

    const c6 = row.getCell(6);
    if (r.normaisMin != null && Number.isFinite(r.normaisMin)) {
      c6.value = durationFractionFromMinutes(Math.max(0, r.normaisMin));
      c6.numFmt = "[h]:mm";
    } else {
      c6.value = "—";
    }
    c6.font = { size: 10 };
    c6.alignment = { vertical: "middle", horizontal: "center" };
    c6.border = thinBorder();
    if (fill) c6.fill = fill;

    const c7 = row.getCell(7);
    c7.value = r.faltasText?.trim() ? r.faltasText : "—";
    c7.font = { size: 10 };
    c7.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c7.border = thinBorder();
    if (fill) c7.fill = fill;

    const c8 = row.getCell(8);
    if (r.horaExtraMin > 0) {
      c8.value = durationFractionFromMinutes(r.horaExtraMin);
      c8.numFmt = "[h]:mm";
    } else {
      c8.value = "—";
    }
    c8.font = { size: 10 };
    c8.alignment = { vertical: "middle", horizontal: "center" };
    c8.border = thinBorder();
    if (fill) c8.fill = fill;

    const c9 = row.getCell(9);
    c9.value = Math.round(r.atrasoMin);
    c9.numFmt = "0";
    c9.font = { size: 10 };
    c9.alignment = { vertical: "middle", horizontal: "center" };
    c9.border = thinBorder();
    if (fill) c9.fill = fill;
  });

  ws.columns = [
    { width: 12 },
    { width: 32 },
    { width: 36 },
    { width: 10 },
    { width: 10 },
    { width: 11 },
    { width: 28 },
    { width: 11 },
    { width: 14 },
  ];

  const lastDataRow = dataStartRow + Math.max(0, rows.length - 1);
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: lastDataRow, column: HEADER_LABELS.length },
    };
  }

  /* Congela título, filtros e cabeçalho da tabela; rolagem a partir da 1ª linha de dados. */
  ws.views = [
    {
      state: "frozen",
      ySplit: headerRowIndex + 1,
      topLeftCell: `A${headerRowIndex + 1}`,
      activeCell: `A${headerRowIndex + 1}`,
    },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
