import { useCallback } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { SancaoDisciplinarRow } from "@rh/types/api";
import {
  emptySancaoFields,
  SANCOES_SHEET_MAIN,
  mapSanHeaderToField,
  normalizeSanHeader,
} from "./sancoes-disciplinares-excel";

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && value >= 1e9 && value <= 1e12) {
      return String(Math.trunc(value));
    }
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function cellToIsoDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 59 && value < 1_000_000) {
    const ms = (value - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    if (!isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(value).trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [a, b, year] = s.split("/").map(Number);
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateToBR(isoOrAny: string): string {
  if (!isoOrAny || !isoOrAny.trim()) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoOrAny.trim());
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(isoOrAny.trim())) return isoOrAny.trim();
  return isoOrAny.trim();
}

function rowToExportArray(row: SancaoDisciplinarRow): (string | number)[] {
  const b = emptySancaoFields();
  const r = { ...b, ...row };
  return [
    r.matricula,
    r.nomeFuncionario,
    r.tipo,
    formatDateToBR(r.dataAplicacao),
    r.mes,
    r.ano,
    r.observacoes,
  ];
}

function recordToSancao(obj: Record<string, unknown>): Omit<SancaoDisciplinarRow, "id"> | null {
  const base = emptySancaoFields();
  for (const [k, v] of Object.entries(obj)) {
    const norm = normalizeSanHeader(k);
    const field = mapSanHeaderToField(norm);
    if (!field) continue;
    if (field === "dataAplicacao") {
      base.dataAplicacao = cellToIsoDate(v);
    } else {
      base[field] = cellToString(v);
    }
  }
  if (!base.dataAplicacao.trim()) return null;
  return base;
}

function isRowRecordEmpty(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((v) => cellToString(v) === "");
}

export function useSancoesDisciplinaresExcel() {
  const parseFile = useCallback(async (file: File): Promise<Omit<SancaoDisciplinarRow, "id">[]> => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array", cellDates: true });
    const sheetName =
      wb.SheetNames.includes(SANCOES_SHEET_MAIN) ? SANCOES_SHEET_MAIN : wb.SheetNames[0] ?? "";
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
    const out: Omit<SancaoDisciplinarRow, "id">[] = [];
    for (const rec of raw) {
      if (isRowRecordEmpty(rec)) continue;
      const row = recordToSancao(rec);
      if (row) out.push(row);
    }
    return out;
  }, []);

  const exportToExcel = useCallback(async (rows: SancaoDisciplinarRow[], filename = "sancoes-disciplinares.xlsx") => {
    const response = await fetch("/modelo-sancoes-disciplinares.xlsx");
    if (!response.ok) throw new Error("Modelo não encontrado");
    const ab = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(ab);
    const wsMain = workbook.getWorksheet(SANCOES_SHEET_MAIN);
    if (!wsMain) throw new Error(`Planilha "${SANCOES_SHEET_MAIN}" não encontrada no modelo`);
    const lastMain = wsMain.lastRow?.number ?? 1;
    if (lastMain > 1) {
      wsMain.spliceRows(2, lastMain - 1);
    }
    for (const row of rows) {
      wsMain.addRow(rowToExportArray(row));
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  return { parseFile, exportToExcel };
}
