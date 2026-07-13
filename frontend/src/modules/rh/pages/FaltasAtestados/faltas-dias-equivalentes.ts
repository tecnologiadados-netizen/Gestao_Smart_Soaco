import type { FaltaRow } from "@rh/types/api";

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase();
}

export function parseLooseNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^-?\d+(,\d+)?$/.test(raw)) {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function periodoQuantidadeMode(periodo: string): "horas" | "dias" | "livre" {
  const raw = normalizeText(periodo);
  if (!raw) return "livre";
  if (raw.includes("INTEGRAL")) return "dias";
  if (raw.includes("PARCIAL") && (raw.includes("MANHA") || raw.includes("TARDE"))) return "horas";
  return "livre";
}

export function parseFractionOrNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const fraction = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/.exec(raw);
  if (fraction) {
    const left = Number(fraction[1].replace(",", "."));
    const right = Number(fraction[2].replace(",", "."));
    if (Number.isFinite(left) && Number.isFinite(right) && right > 0) return left / right;
  }
  return parseLooseNumber(raw);
}

export function diasPerdidosEquivalentes(row: FaltaRow): {
  value: number;
  converted: boolean;
  usedEstimatedHours: boolean;
} {
  const mode = periodoQuantidadeMode(row.periodo);
  const qntd = parseLooseNumber(row.qntd);
  const diasTurno = parseFractionOrNumber(row.diasTurno);

  if (mode === "dias" && qntd != null) {
    return { value: qntd, converted: true, usedEstimatedHours: false };
  }

  if (mode === "horas") {
    if (diasTurno != null && diasTurno > 0 && diasTurno <= 1) {
      return { value: diasTurno, converted: true, usedEstimatedHours: false };
    }
    if (qntd != null) {
      return { value: qntd / 8, converted: true, usedEstimatedHours: true };
    }
  }

  if (diasTurno != null && diasTurno > 0 && diasTurno <= 1) {
    return { value: diasTurno, converted: true, usedEstimatedHours: false };
  }

  if (qntd != null) {
    return { value: qntd, converted: true, usedEstimatedHours: false };
  }

  return { value: 0, converted: false, usedEstimatedHours: false };
}
