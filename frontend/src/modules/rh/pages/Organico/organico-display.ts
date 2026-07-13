/**
 * Formatação de exibição e normalização ao salvar — modal/cards do Orgânico.
 * Alinha moeda (R$), datas (DD/MM/AAAA), CPF e percentuais ao padrão brasileiro.
 */
import { ORGANICO_HEADERS } from "./organico-headers";
import { parseCtpsToNumber } from "./organico-derive";
import {
  COLUNA_CPF,
  COLUNAS_DATA,
  COLUNAS_PERCENTUAL,
  COLUNAS_MOEDA_DADOS,
  COLUNAS_FORMULA_MOEDA,
  isColunaDerivadaSistema,
} from "./organico-excel-schema";
import type { OrganicoSheetRow } from "./useOrganicoImport";

/** Moeda (fórmulas + CTPS + Adendo). Coluna 69 pode ser "-". */
const COLUNAS_MOEDA_EXIBICAO = new Set<number>([...COLUNAS_FORMULA_MOEDA, ...COLUNAS_MOEDA_DADOS, 72]);

export function formatCurrencyBRLDisplay(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** CPF: XXX.XXX.XXX-XX */
export function formatCPFDisplay(raw: unknown): string {
  const digits = String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (digits.length === 0) return "";
  const p = digits.padStart(11, "0");
  return p.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Data: DD/MM/AAAA (aceita ISO, serial Excel, DD/MM existente). */
export function formatDateBRDisplay(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const d = raw.getDate().toString().padStart(2, "0");
    const m = (raw.getMonth() + 1).toString().padStart(2, "0");
    const y = raw.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 59 && raw < 1_000_000) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      const dd = d.getUTCDate().toString().padStart(2, "0");
      const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  }
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  return s;
}

/**
 * Interpreta percentual armazenado (0–1), digitado (0–100) ou já com símbolo %.
 * Não remove ponto decimal de valores como "0.4" (40% interno).
 */
function parsePercentNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  const s = String(raw).trim().replace(/%/g, "").replace(/\s/g, "");
  if (!s) return null;

  // Formato interno decimal (ex.: "0.4" = 40%)
  if (/^\d*\.\d+$/.test(s)) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Percentual para leitura: valor interno 0–1 ou 0–100 → "X%". */
export function formatPercentDisplay(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const n = parsePercentNumber(raw);
  if (n == null) return String(raw).trim();
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false })}%`;
}

/**
 * Valor para mostrar no input (modal) a partir do dado bruto da linha/API.
 */
export function getOrganicoCellDisplayValue(colIndex: number, raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (colIndex === COLUNA_CPF) return formatCPFDisplay(raw);
  if (COLUNAS_DATA.has(colIndex)) return formatDateBRDisplay(raw);
  if (COLUNAS_PERCENTUAL.has(colIndex)) return formatPercentDisplay(raw);
  if (COLUNAS_MOEDA_EXIBICAO.has(colIndex)) {
    if (typeof raw === "string" && raw.trim() === "-") return "-";
    const n = typeof raw === "number" && Number.isFinite(raw) ? raw : parseCtpsToNumber(raw);
    if (!Number.isFinite(n)) return String(raw).trim();
    return formatCurrencyBRLDisplay(n);
  }
  return String(raw).trim();
}

function normalizeCPFForStorage(s: string): string {
  const d = s.replace(/\D/g, "").slice(0, 11);
  return d;
}

function normalizeDateForStorage(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const [y, m, d] = t.slice(0, 10).split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return t;
}

function normalizePercentForStorage(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const n = parsePercentNumber(t);
  if (n == null) return t;
  const internal = n > 1 ? n / 100 : n;
  return String(internal);
}

function normalizeMoneyForStorage(s: string): string {
  const t = s.trim();
  if (!t || t === "-") return "";
  const n = parseCtpsToNumber(t);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

/**
 * Converte texto digitado / exibido no modal de volta ao formato esperado pelo restante do app (e fórmulas).
 * Colunas de fórmula são zeradas aqui e recalculadas em seguida por `calcularFormulasRow`.
 */
export function displayCellsToStorageRow(cells: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ORGANICO_HEADERS.length; i++) {
    if (isColunaDerivadaSistema(i)) {
      out.push("");
      continue;
    }
    const raw = cells[i] ?? "";
    if (i === COLUNA_CPF) {
      out.push(normalizeCPFForStorage(raw));
      continue;
    }
    if (COLUNAS_DATA.has(i)) {
      out.push(normalizeDateForStorage(raw));
      continue;
    }
    if (COLUNAS_PERCENTUAL.has(i)) {
      out.push(normalizePercentForStorage(raw));
      continue;
    }
    if (COLUNAS_MOEDA_EXIBICAO.has(i) && !isColunaDerivadaSistema(i)) {
      out.push(normalizeMoneyForStorage(raw));
      continue;
    }
    out.push(String(raw).trim());
  }
  while (out.length < ORGANICO_HEADERS.length) out.push("");
  return out.slice(0, ORGANICO_HEADERS.length);
}

/** Linha da grade → células formatadas para o formulário. */
export function rowToDisplayCells(row: OrganicoSheetRow): string[] {
  const cells = Array.isArray(row) ? row : [];
  const out: string[] = [];
  for (let i = 0; i < ORGANICO_HEADERS.length; i++) {
    out.push(getOrganicoCellDisplayValue(i, cells[i]));
  }
  return out;
}
