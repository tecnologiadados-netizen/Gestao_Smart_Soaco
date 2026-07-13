import * as XLSX from "xlsx";
import type { OrganicoRow } from "@rh/types/api";
import type { SecullumFuncionario } from "@rh/lib/api-client";
import {
  buildCtpsByMatriculaNormFromOrganico,
  buildCtpsByNomeNormFromOrganico,
  buildPeopleByMatriculaNormFromOrganico,
  buildPeopleLookupFromOrganico,
  buildTurnoByNomeNormFromOrganico,
  normalizeAbsenteismoNomeKey,
  normalizeMatriculaKey,
} from "./organico-match";
import {
  buildCtpsByNomeNormFromSecullum,
  buildCtpsByNumeroFolhaNormFromSecullum,
  resolveCtpsForAbsenteismoRow,
} from "./secullum-ctps-resolve";
import type { AbsenteismoPorHorasRow } from "./types";

/** Aba padrão do modelo `base_atrasados2.xlsx`. */
export const ABSENTEISMO_POR_HORAS_SHEET = "Consolidado";

export type ParseAbsenteismoPorHorasStats = {
  /** Linhas retornadas por `sheet_to_json`. */
  inputRows: number;
  /** Linhas convertidas em `AbsenteismoPorHorasRow`. */
  outputRows: number;
  /** Sem data, nome ou ENT. 1 válidos (ou linha vazia). */
  skippedInvalid: number;
  /** Férias, folga, atestado etc. (texto em FALTAS / observação). */
  skippedAbsence: number;
  /** Sem horário previsto (turno da planilha + Orgânico sem HH:MM). */
  skippedNoSchedule: number;
};

export type ParseAbsenteismoPorHorasResult = {
  rows: AbsenteismoPorHorasRow[];
  stats: ParseAbsenteismoPorHorasStats;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Palavras-chave em texto já sem acentos e em maiúsculas. */
const ABSENCE_KEYWORD_MARKERS = [
  "FERIAS",
  "FOLGA",
  "ATEST",
  "ATESTADO",
  "DECLARACAO",
  "LICENCA",
  "DSR",
  "DESCANSO",
  "REPOUSO",
  "AFASTAMENTO",
  "MATERNIDADE",
  "PATERNIDADE",
  "GOZO",
  "ACIDENTE",
  "SUSPENSAO",
] as const;

function normalizeForAbsenceScan(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Exclui dias sem jornada “normal” (férias, folga, atestado, licença, DSR, etc.). */
export function rowLooksLikeNonWorkDay(faltasText: string, nome: string): boolean {
  const t = normalizeForAbsenceScan(`${faltasText} ${nome}`);
  if (!t) return false;
  return ABSENCE_KEYWORD_MARKERS.some((kw) => {
    const k = normalizeForAbsenceScan(kw);
    return k && t.includes(k);
  });
}

function isoDateFromCell(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 60000) {
    const ms = (value - 25569) * 86_400_000;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const raw = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (br) {
    const dd = String(Number(br[1])).padStart(2, "0");
    const mm = String(Number(br[2])).padStart(2, "0");
    return `${br[3]}-${mm}-${dd}`;
  }
  return "";
}

/**
 * Horários de ponto (ENT. 1, EXTRAS, etc.) vêm como `Date` serial do Excel (ex.: 1899-12-30T10:02:00.000Z).
 * O SheetJS/`xlsx` grava o instante em UTC; na planilha aberta no Brasil o mesmo registro aparece como 07:02.
 * Usar **getHours/getMinutes locais** alinha o cálculo ao que o RH vê no Excel (evita ~3h de “atraso fantasma”).
 */
function minutesFromTimeCell(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = value.getHours();
    const m = value.getMinutes();
    const s = value.getSeconds();
    return h * 60 + m + Math.round(s / 60);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60);
  }
  const raw = String(value).trim();
  const match = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!match) return null;
  const h = Number(match[1]);
  const mi = Number(match[2]);
  const sec = match[3] != null ? Number(match[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(mi) || !Number.isFinite(sec)) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || sec < 0 || sec > 59) return null;
  return h * 60 + mi + Math.round(sec / 60);
}

function minutesFromDurationCell(value: unknown): number {
  const m = minutesFromTimeCell(value);
  return m == null ? 0 : Math.max(0, m);
}

export function parseTurnoBounds(turnoRaw: string): { entrada: number | null; saida: number | null } {
  const turno = String(turnoRaw ?? "");
  const matches = [...turno.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (matches.length === 0) return { entrada: null, saida: null };
  const toMin = (idx: number) => {
    const g = matches[idx];
    if (!g) return null;
    const h = Number(g[1]);
    const m = Number(g[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  return { entrada: toMin(0), saida: matches.length > 1 ? toMin(matches.length - 1) : null };
}

function mapHeaderToField(
  norm: string,
): "data" | "nome" | "turno" | "ent1" | "sai2" | "normais" | "faltas" | "extras" | "matricula" | null {
  if (norm === "DATA") return "data";
  if (norm === "NOME") return "nome";
  if (norm === "TURNO") return "turno";
  if (norm.startsWith("ENT") && (norm.includes("1") || norm.endsWith("ENT1"))) return "ent1";
  if (norm === "ENTRADA" || norm === "ENTRADA 1") return "ent1";
  if (norm.startsWith("SAI") && (norm.includes("2") || norm.endsWith("SAI2"))) return "sai2";
  if (norm === "SAIDA" || norm === "SAIDA 2") return "sai2";
  if (norm === "NORMAIS" || norm === "NORMA") return "normais";
  if (norm === "FALTAS") return "faltas";
  if (norm === "EXTRAS" || norm === "EXTRA") return "extras";
  if (norm === "MATRICULA" || norm === "REGISTRO" || norm === "RE") return "matricula";
  if (norm === "OBSERVACAO" || norm === "OBSERVACOES" || norm === "OBS") return "faltas";
  return null;
}

/** Texto exibível da célula (FALTAS e similares), preservando o que veio da planilha. */
function cellAsPlainText(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = value.getHours();
    const m = value.getMinutes();
    const s = value.getSeconds();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1 && value < 1_000_000) {
    const m = minutesFromTimeCell(value);
    if (m != null) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }
  return String(value).trim();
}

function extractFields(rec: Record<string, unknown>): {
  dataIso: string;
  nome: string;
  turno: string;
  ent1: number;
  sai2Min: number | null;
  normaisMin: number | null;
  faltasText: string;
  extrasMin: number;
  matriculaPlanilha: string;
} | null {
  let dataIso = "";
  let nome = "";
  let turno = "";
  let ent1: number | null = null;
  let sai2Min: number | null = null;
  let normaisMin: number | null = null;
  let faltasText = "";
  let extrasMin = 0;
  let matriculaPlanilha = "";

  for (const [k, v] of Object.entries(rec)) {
    const field = mapHeaderToField(normalizeHeader(k));
    if (!field) continue;
    if (field === "data") dataIso = isoDateFromCell(v);
    else if (field === "nome") nome = String(v ?? "").trim();
    else if (field === "turno") turno = String(v ?? "").trim();
    else if (field === "ent1") ent1 = minutesFromTimeCell(v);
    else if (field === "sai2") sai2Min = minutesFromTimeCell(v);
    else if (field === "normais") {
      const n = minutesFromTimeCell(v);
      normaisMin = n == null ? null : n;
    } else if (field === "faltas") {
      const piece = cellAsPlainText(v);
      if (piece) faltasText = faltasText ? `${faltasText} · ${piece}` : piece;
    } else if (field === "extras") extrasMin = minutesFromDurationCell(v);
    else if (field === "matricula") matriculaPlanilha = String(v ?? "").trim();
  }

  if (!dataIso || !nome || ent1 == null) return null;
  return { dataIso, nome, turno, ent1, sai2Min, normaisMin, faltasText, extrasMin, matriculaPlanilha };
}

function injectTurnoFromOrganico(
  rec: Record<string, unknown>,
  turnoByNomeNorm: Map<string, string>,
): Record<string, unknown> {
  let nome = "";
  let existingTurno = "";
  let turnoKey: string | null = null;
  for (const [k, v] of Object.entries(rec)) {
    const field = mapHeaderToField(normalizeHeader(k));
    if (field === "nome") nome = String(v ?? "").trim();
    if (field === "turno") {
      turnoKey = k;
      existingTurno = String(v ?? "").trim();
    }
  }
  if (existingTurno || !nome) return rec;
  const t = (turnoByNomeNorm.get(normalizeAbsenteismoNomeKey(nome)) ?? "").trim();
  if (!t) return rec;
  const out = { ...rec };
  if (turnoKey) out[turnoKey] = t;
  else out.TURNO = t;
  return out;
}

function sheetLooksLikePontoDiario(raw: Record<string, unknown>[]): boolean {
  if (raw.length === 0) return false;
  const keys = Object.keys(raw[0] ?? {});
  const norms = new Set(keys.map((k) => normalizeHeader(k)));
  if (!norms.has("DATA") || !norms.has("NOME")) return false;
  return [...norms].some(
    (n) =>
      (n.startsWith("ENT") && n.includes("1")) ||
      n === "ENTRADA" ||
      n === "ENTRADA 1" ||
      (n.startsWith("ENT") && n.endsWith("ENT1")),
  );
}

function pickWorksheet(wb: XLSX.WorkBook): { name: string; ws: XLSX.WorkSheet } | null {
  const names = wb.SheetNames;
  if (names.length === 0) return null;
  if (names.includes(ABSENTEISMO_POR_HORAS_SHEET)) {
    const ws = wb.Sheets[ABSENTEISMO_POR_HORAS_SHEET];
    if (ws) return { name: ABSENTEISMO_POR_HORAS_SHEET, ws };
  }
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
    if (sheetLooksLikePontoDiario(raw)) return { name, ws };
  }
  const first = names[0]!;
  const ws = wb.Sheets[first];
  return ws ? { name: first, ws } : null;
}

function buildRowsFromRaw(
  raw: Record<string, unknown>[],
  organicoRows: OrganicoRow[],
  secullumFuncionarios: SecullumFuncionario[],
): ParseAbsenteismoPorHorasResult {
  const turnoByNome = buildTurnoByNomeNormFromOrganico(organicoRows);
  const people = buildPeopleLookupFromOrganico(organicoRows);
  const peopleByMat = buildPeopleByMatriculaNormFromOrganico(organicoRows);
  const organicoByMat = buildCtpsByMatriculaNormFromOrganico(organicoRows);
  const organicoByNome = buildCtpsByNomeNormFromOrganico(organicoRows);
  const secullumByMat = buildCtpsByNumeroFolhaNormFromSecullum(secullumFuncionarios);
  const secullumByNome = buildCtpsByNomeNormFromSecullum(secullumFuncionarios);

  const stats: ParseAbsenteismoPorHorasStats = {
    inputRows: raw.length,
    outputRows: 0,
    skippedInvalid: 0,
    skippedAbsence: 0,
    skippedNoSchedule: 0,
  };

  const out: AbsenteismoPorHorasRow[] = [];
  for (const rec of raw) {
    if (!rec || typeof rec !== "object") {
      stats.skippedInvalid += 1;
      continue;
    }
    const withTurno = injectTurnoFromOrganico(rec as Record<string, unknown>, turnoByNome);
    const ex = extractFields(withTurno);
    if (!ex) {
      stats.skippedInvalid += 1;
      continue;
    }
    if (rowLooksLikeNonWorkDay(ex.faltasText, ex.nome)) {
      stats.skippedAbsence += 1;
      continue;
    }
    const { entrada, saida } = parseTurnoBounds(ex.turno);
    if (entrada == null) {
      stats.skippedNoSchedule += 1;
      continue;
    }

    const atrasoMin = Math.max(0, ex.ent1 - entrada);
    const d = new Date(`${ex.dataIso}T12:00:00.000Z`);
    const weekdayIndex = Number.isNaN(d.getTime()) ? 0 : d.getUTCDay();
    const nomeKey = normalizeAbsenteismoNomeKey(ex.nome);
    const matKey = normalizeMatriculaKey(ex.matriculaPlanilha);
    const org =
      matKey && peopleByMat.has(matKey) ? peopleByMat.get(matKey)! : people.byNomeNorm.get(nomeKey);

    const { ctps: ctpsOrganico, source: ctpsSource } = resolveCtpsForAbsenteismoRow({
      nomeKey,
      matriculaPlanilha: ex.matriculaPlanilha,
      matriculaOrganico: org?.matricula ?? "",
      secullumByMat,
      secullumByNome,
      organicoByMat,
      organicoByNome,
    });

    out.push({
      dataIso: ex.dataIso,
      nome: ex.nome,
      turno: ex.turno,
      entradaPrevistaMin: entrada,
      saidaPrevistaMin: saida,
      entradaRealMin: ex.ent1,
      atrasoMin,
      horaExtraMin: ex.extrasMin,
      saidaRealMin: ex.sai2Min,
      normaisMin: ex.normaisMin,
      faltasText: ex.faltasText,
      weekdayIndex,
      bucketDia: ex.dataIso,
      bucketMes: ex.dataIso.slice(0, 7),
      setorOrganico: org?.setor ?? "",
      equipeOrganico: org?.equipe ?? "",
      matriculaOrganico: org?.matricula ?? "",
      matriculaPlanilha: ex.matriculaPlanilha.trim(),
      ctpsOrganico,
      ctpsSource,
    });
    stats.outputRows += 1;
  }

  return { rows: out, stats };
}

/** Compat: retorna só as linhas (importadores antigos). */
export async function parseAbsenteismoPorHorasExcel(
  file: File,
  organicoRows?: OrganicoRow[],
  secullumFuncionarios?: SecullumFuncionario[],
): Promise<AbsenteismoPorHorasRow[]> {
  const r = await parseAbsenteismoPorHorasExcelWithStats(file, organicoRows, secullumFuncionarios);
  return r.rows;
}

export async function parseAbsenteismoPorHorasExcelWithStats(
  file: File,
  organicoRows: OrganicoRow[] = [],
  secullumFuncionarios: SecullumFuncionario[] = [],
): Promise<ParseAbsenteismoPorHorasResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const picked = pickWorksheet(wb);
  if (!picked) {
    return {
      rows: [],
      stats: {
        inputRows: 0,
        outputRows: 0,
        skippedInvalid: 0,
        skippedAbsence: 0,
        skippedNoSchedule: 0,
      },
    };
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(picked.ws, { defval: "", raw: true });
  return buildRowsFromRaw(raw, organicoRows, secullumFuncionarios);
}
