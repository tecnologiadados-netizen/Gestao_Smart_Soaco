import {
  ORGANICO_IDX,
  parseCtpsToNumber,
  getStatusFromRow,
  type OrganicoStatus,
} from "@rh/pages/Organico/organico-derive";
import type { OrganicoRow } from "@rh/types/api";
import type { AbsenteismoPorHorasPeopleLookup } from "./types";

/** Mesma chave usada no cruzamento planilha de ponto × Orgânico (nome). */
export function normalizeAbsenteismoNomeKey(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Chave única para matrícula (planilha ou Orgânico). */
export function normalizeMatriculaKey(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function organicoStatusRank(s: OrganicoStatus): number {
  switch (s) {
    case "Ativo":
      return 0;
    case "Férias":
      return 1;
    case "Afastado":
      return 2;
    case "Desligado":
      return 3;
    default:
      return 2;
  }
}

type PersonEntry = { setor: string; equipe: string; matricula: string; nome: string; statusRank: number };

function rowToPersonEntry(values: unknown[]): PersonEntry | null {
  const nome = String(values[ORGANICO_IDX.NOME] ?? "").trim();
  if (!nome) return null;
  const matricula = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim();
  const equipe = String(values[ORGANICO_IDX.AREA] ?? "").trim();
  const statusRank = organicoStatusRank(getStatusFromRow(values as (string | number)[]));
  return { setor, equipe, matricula, nome, statusRank };
}

/** Dados do colaborador por matrícula normalizada (última linha com a mesma matrícula vence — alinhado à API). */
export function buildPeopleByMatriculaNormFromOrganico(
  rows: OrganicoRow[],
): Map<string, { setor: string; equipe: string; matricula: string; nome: string }> {
  const m = new Map<string, { setor: string; equipe: string; matricula: string; nome: string }>();
  for (const row of rows) {
    const values = Array.isArray(row.values) ? row.values : [];
    const matricula = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!matricula) continue;
    const key = normalizeMatriculaKey(matricula);
    if (!key) continue;
    const nome = String(values[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim();
    const equipe = String(values[ORGANICO_IDX.AREA] ?? "").trim();
    m.set(key, { setor, equipe, matricula, nome });
  }
  return m;
}

/** CTPS (coluna 52) por matrícula normalizada. */
export function buildCtpsByMatriculaNormFromOrganico(rows: OrganicoRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of rows) {
    const values = Array.isArray(row.values) ? row.values : [];
    const matricula = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!matricula) continue;
    const key = normalizeMatriculaKey(matricula);
    if (!key) continue;
    m.set(key, parseCtpsToNumber(values[ORGANICO_IDX.CTPS]));
  }
  return m;
}

/**
 * Cruza colaboradores da planilha de ponto com a base do Orgânico (match principal: nome).
 * Em **homônimos**, prioriza cadastro **Ativo** (depois Férias, Afastado, Desligado), alinhando ao colaborador
 * que o RH costuma ver na aba Orgânico.
 */
export function buildPeopleLookupFromOrganico(rows: OrganicoRow[]): AbsenteismoPorHorasPeopleLookup {
  const byNomeNorm = new Map<string, PersonEntry>();

  for (const row of rows) {
    const values = Array.isArray(row.values) ? row.values : [];
    const entry = rowToPersonEntry(values);
    if (!entry) continue;
    const key = normalizeAbsenteismoNomeKey(entry.nome);
    if (!key) continue;
    const prev = byNomeNorm.get(key);
    if (!prev || entry.statusRank < prev.statusRank) {
      byNomeNorm.set(key, entry);
    }
  }

  const out = new Map<string, { setor: string; equipe: string; matricula: string; nome: string }>();
  for (const [k, v] of byNomeNorm) {
    const { statusRank: _, ...rest } = v;
    out.set(k, rest);
  }

  return { byNomeNorm: out };
}

/**
 * CTPS por nome normalizado — mesma regra de desempate por **status** que `buildPeopleLookupFromOrganico`
 * (evita pegar salário de homônimo desligado / linha duplicada).
 */
/**
 * Coluna TURNO do Orgânico por nome normalizado — mesma regra de desempate por **status** que
 * `buildPeopleLookupFromOrganico` (homônimos).
 */
export function buildTurnoByNomeNormFromOrganico(rows: OrganicoRow[]): Map<string, string> {
  const m = new Map<string, { turno: string; statusRank: number }>();

  for (const row of rows) {
    const values = Array.isArray(row.values) ? row.values : [];
    const nome = String(values[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const key = normalizeAbsenteismoNomeKey(nome);
    if (!key) continue;
    const turno = String(values[ORGANICO_IDX.TURNO] ?? "").trim();
    const statusRank = organicoStatusRank(getStatusFromRow(values as (string | number)[]));
    const prev = m.get(key);
    if (!prev || statusRank < prev.statusRank) {
      m.set(key, { turno, statusRank });
    }
  }

  const out = new Map<string, string>();
  for (const [k, v] of m) {
    out.set(k, v.turno);
  }
  return out;
}

export function buildCtpsByNomeNormFromOrganico(rows: OrganicoRow[]): Map<string, number> {
  const m = new Map<string, { ctps: number; statusRank: number }>();

  for (const row of rows) {
    const values = Array.isArray(row.values) ? row.values : [];
    const nome = String(values[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const key = normalizeAbsenteismoNomeKey(nome);
    if (!key) continue;
    const ctps = parseCtpsToNumber(values[ORGANICO_IDX.CTPS]);
    const statusRank = organicoStatusRank(getStatusFromRow(values as (string | number)[]));
    const prev = m.get(key);
    if (!prev || statusRank < prev.statusRank) {
      m.set(key, { ctps, statusRank });
    }
  }

  const out = new Map<string, number>();
  for (const [k, v] of m) {
    out.set(k, v.ctps);
  }
  return out;
}
