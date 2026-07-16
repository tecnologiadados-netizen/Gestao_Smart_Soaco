/**
 * Colunas bancárias, telefone e afins: sempre texto (como na planilha validada),
 * sem conversão para número no Excel (evita perda de zeros, hífens e PIX com pontos).
 */
import { ORGANICO_IDX } from "./organico-derive";

/** Índices que devem permanecer como texto na importação, armazenamento e exportação. */
export const ORGANICO_COLUNAS_TEXTO_FINANCEIRO = new Set<number>([
  ORGANICO_IDX.PIS,
  ORGANICO_IDX.TELEFONE,
  ORGANICO_IDX.TELEFONE_EMERGENCIAL,
  75, // AGENCIA
  76, // CONTA
  77, // BANCO
  78, // CHAVE PIX
  79, // CASO NÃO TENHA PIX
]);

type XlsxCellLike = { t?: string; v?: unknown; w?: string } | undefined;

function isTelefoneCol(colIndex: number): boolean {
  return colIndex === ORGANICO_IDX.TELEFONE || colIndex === ORGANICO_IDX.TELEFONE_EMERGENCIAL;
}

function isAgenciaCol(colIndex: number): boolean {
  return colIndex === 75;
}

/** Número do Excel → string sem notação científica. */
export function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toLocaleString("en-US", { maximumFractionDigits: 20, useGrouping: false });
}

/**
 * Lê célula do Excel preservando o formato da planilha (texto exibido ou valor literal).
 */
export function readOrganicoFinancialCell(cell: XlsxCellLike, colIndex: number): string {
  if (!cell) return "";

  const displayed = String(cell.w ?? "").trim();
  if (displayed) return displayed;

  if (cell.t === "s" || cell.t === "str") {
    return String(cell.v ?? "").trim();
  }

  if (cell.t === "n" && typeof cell.v === "number") {
    return formatFinancialNumberFromExcel(cell.v, colIndex);
  }

  if (cell.v == null || cell.v === "") return "";
  return String(cell.v).trim();
}

/** Converte número importado do Excel para o texto armazenado no sistema. */
export function formatFinancialNumberFromExcel(n: number, colIndex: number): string {
  if (!Number.isFinite(n)) return "";

  if (isTelefoneCol(colIndex)) {
    const digits = String(Math.trunc(Math.abs(n))).replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) return digits;
    return numberToPlainString(n);
  }

  if (isAgenciaCol(colIndex) && Number.isInteger(n) && n >= 0 && n < 10000) {
    return String(Math.trunc(n)).padStart(4, "0");
  }

  if (Number.isInteger(n)) return numberToPlainString(Math.trunc(n));
  return numberToPlainString(n);
}

/**
 * Valor já no sistema → texto para exportar no Excel (célula com formato @).
 */
export function formatFinancialForExport(value: unknown, colIndex: number): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (!s || s === "-") return s === "-" ? "-" : "";

  if (isTelefoneCol(colIndex)) {
    if (/[^\d]/.test(s)) return s;
    return s.replace(/\D/g, "");
  }

  if (isAgenciaCol(colIndex)) {
    const digits = s.replace(/\D/g, "");
    if (digits && digits.length <= 4 && /^\d+$/.test(digits)) {
      return digits.padStart(4, "0");
    }
    return s;
  }

  return s;
}

/** Normaliza valor vindo de parse genérico (sem célula XLSX) para colunas financeiras. */
export function normalizeFinancialStoredValue(value: unknown, colIndex: number): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatFinancialNumberFromExcel(value, colIndex);
  }
  const s = String(value).trim();
  if (!s) return "";
  if (isAgenciaCol(colIndex)) {
    const digits = s.replace(/\D/g, "");
    if (digits && digits.length <= 4 && /^\d+$/.test(digits)) return digits.padStart(4, "0");
  }
  return s;
}
