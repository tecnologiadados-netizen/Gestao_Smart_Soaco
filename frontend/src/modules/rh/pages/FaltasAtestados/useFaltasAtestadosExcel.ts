import { useCallback } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { FaltaRow, FaltaCadastrosData } from "@rh/types/api";
import {
  emptyFaltaFields,
  FALTAS_SHEET_MAIN,
  FALTAS_SHEET_CADASTROS,
  mapFaltasHeaderToField,
  normalizeFaltasHeader,
} from "./faltas-atestados-excel";

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

function numericCellOrText(value: string): string | number {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^-?\d+(,\d+)?$/.test(raw)) {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : raw;
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

function rowToExportArray(row: FaltaRow): (string | number)[] {
  const b = emptyFaltaFields();
  const r = { ...b, ...row };
  return [
    formatDateToBR(r.data),
    r.mesFalta,
    r.matricula,
    r.nomeFuncionario,
    r.endereco,
    r.area,
    r.setor,
    r.lider,
    r.periodo,
    numericCellOrText(r.qntd),
    r.diasTurno,
    r.tipo,
    r.cid,
    r.localAtendimento,
    r.medicoResponsavel,
    r.observacoes,
  ];
}

function recordToFalta(obj: Record<string, unknown>): Omit<FaltaRow, "id"> | null {
  const base = emptyFaltaFields();
  for (const [k, v] of Object.entries(obj)) {
    const norm = normalizeFaltasHeader(k);
    const field = mapFaltasHeaderToField(norm);
    if (!field) continue;
    if (field === "data") {
      base.data = cellToIsoDate(v);
    } else {
      base[field] = cellToString(v);
    }
  }
  if (!base.data.trim()) return null;
  return base;
}

function isRowRecordEmpty(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((v) => cellToString(v) === "");
}

function normalizeCadastroHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type ParsedCadastrosLists = {
  periodos: string[];
  tipos: string[];
  cids: string[];
  tiposSancoes: string[];
};

function isTiposSancoesHeader(nk: string): boolean {
  return (
    nk === "TIPOS DE SANCOES" ||
    nk === "TIPO DE SANCAO" ||
    nk === "TIPOS DE SANCOES DISCIPLINARES" ||
    nk.startsWith("TIPOS DE SANCO")
  );
}

/** Lê aba Cadastros: colunas PERÍODO, TIPO, CID, TIPOS DE SANÇÕES (uma lista por coluna). */
export async function parseCadastrosExcelFile(file: File): Promise<ParsedCadastrosLists> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes(FALTAS_SHEET_CADASTROS) ? FALTAS_SHEET_CADASTROS : wb.SheetNames[0] ?? "";
  if (!sheetName) return { periodos: [], tipos: [], cids: [], tiposSancoes: [] };
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  const periodos: string[] = [];
  const tipos: string[] = [];
  const cids: string[] = [];
  const tiposSancoes: string[] = [];
  for (const rec of raw) {
    if (isRowRecordEmpty(rec)) continue;
    let periodo = "";
    let tipo = "";
    let cid = "";
    let tipoSancao = "";
    for (const [k, v] of Object.entries(rec)) {
      const nk = normalizeCadastroHeader(k);
      const val = cellToString(v);
      if (nk === "PERIODO" || nk === "PERÍODO") periodo = val;
      else if (isTiposSancoesHeader(nk)) tipoSancao = val;
      else if (nk === "TIPO") tipo = val;
      else if (nk === "CID") cid = val;
    }
    if (periodo) periodos.push(periodo);
    if (tipo) tipos.push(tipo);
    if (cid) cids.push(cid);
    if (tipoSancao) tiposSancoes.push(tipoSancao);
  }
  return { periodos, tipos, cids, tiposSancoes };
}

export function useFaltasAtestadosExcel() {
  const parseFile = useCallback(async (file: File): Promise<Omit<FaltaRow, "id">[]> => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array", cellDates: true });
    const sheetName =
      wb.SheetNames.includes(FALTAS_SHEET_MAIN) ? FALTAS_SHEET_MAIN : wb.SheetNames[0] ?? "";
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
    const out: Omit<FaltaRow, "id">[] = [];
    for (const rec of raw) {
      if (isRowRecordEmpty(rec)) continue;
      const row = recordToFalta(rec);
      if (row) out.push(row);
    }
    return out;
  }, []);

  const exportToExcel = useCallback(
    async (faltasRows: FaltaRow[], cadastro: FaltaCadastrosData, filename = "faltas-atestados.xlsx") => {
      const response = await fetch("/modelo-faltas-atestados.xlsx");
      if (!response.ok) throw new Error("Modelo não encontrado");
      const ab = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);

      const wsMain = workbook.getWorksheet(FALTAS_SHEET_MAIN);
      if (!wsMain) throw new Error(`Planilha "${FALTAS_SHEET_MAIN}" não encontrada no modelo`);

      const lastMain = wsMain.lastRow?.number ?? 1;
      if (lastMain > 1) {
        wsMain.spliceRows(2, lastMain - 1);
      }
      for (const row of faltasRows) {
        wsMain.addRow(rowToExportArray(row));
      }

      const sortVals = (items: { valor: string }[]) =>
        [...items]
          .map((c) => c.valor.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
      const pv = sortVals(cadastro.periodos);
      const tv = sortVals(cadastro.tipos);
      const cv = sortVals(cadastro.cids);
      const sv = sortVals(cadastro.tiposSancoes);
      const cadWs = workbook.getWorksheet(FALTAS_SHEET_CADASTROS);
      if (cadWs) {
        const lastCad = cadWs.lastRow?.number ?? 1;
        if (lastCad > 1) {
          cadWs.spliceRows(2, lastCad - 1);
        }
        const maxR = Math.max(pv.length, tv.length, cv.length, sv.length);
        for (let i = 0; i < maxR; i++) {
          cadWs.addRow([pv[i] ?? "", tv[i] ?? "", cv[i] ?? "", sv[i] ?? ""]);
        }
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
    },
    [],
  );

  return { parseFile, exportToExcel, parseCadastrosExcelFile };
}
