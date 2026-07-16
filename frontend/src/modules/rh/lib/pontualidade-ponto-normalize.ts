import type { AbsenteismoPorHorasRow, CtpsSource } from "@rh/pages/FaltasAtestados/absenteismo-por-horas/types";

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function src(v: unknown): CtpsSource {
  return v === "secullum" ? "secullum" : "organico";
}

/** Converte JSON do banco/API em linha tipada; inválida retorna null. */
export function normalizePontualidadePontoRow(raw: unknown): AbsenteismoPorHorasRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dataIso = str(o.dataIso);
  const nome = str(o.nome);
  if (!dataIso || !nome) return null;
  const entradaPrevistaMin = num(o.entradaPrevistaMin, -1);
  const entradaRealMin = num(o.entradaRealMin, -1);
  if (entradaPrevistaMin < 0 || entradaRealMin < 0) return null;

  return {
    dataIso,
    nome,
    turno: str(o.turno),
    entradaPrevistaMin,
    saidaPrevistaMin: o.saidaPrevistaMin == null ? null : num(o.saidaPrevistaMin),
    entradaRealMin,
    atrasoMin: num(o.atrasoMin, 0),
    horaExtraMin: num(o.horaExtraMin, 0),
    saidaRealMin: o.saidaRealMin == null ? null : num(o.saidaRealMin),
    normaisMin: o.normaisMin == null ? null : num(o.normaisMin),
    faltasText: str(o.faltasText),
    weekdayIndex: Math.max(0, Math.min(6, Math.round(num(o.weekdayIndex, 0)))),
    bucketDia: str(o.bucketDia) || dataIso,
    bucketMes: str(o.bucketMes) || dataIso.slice(0, 7),
    setorOrganico: str(o.setorOrganico),
    equipeOrganico: str(o.equipeOrganico),
    matriculaOrganico: str(o.matriculaOrganico),
    matriculaPlanilha: str(o.matriculaPlanilha),
    ctpsOrganico: num(o.ctpsOrganico, 0),
    ctpsSource: src(o.ctpsSource),
  };
}

export function normalizePontualidadePontoRows(raw: unknown): AbsenteismoPorHorasRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AbsenteismoPorHorasRow[] = [];
  for (const r of raw) {
    const row = normalizePontualidadePontoRow(r);
    if (row) out.push(row);
  }
  return out;
}
