import type { OrganicoSheetRow } from "./useOrganicoImport";
import { ORGANICO_IDX } from "./organico-derive";

/** Valor vazio ou zero “de preenchimento” do Excel (exportação grava 0 em colunas numéricas). */
export function isBlankOrZeroImportCell(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (typeof value === "number" && value === 0) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (s === "0" || s === "0,00" || s === "0.00" || s === "0,0") return true;
  return false;
}

/**
 * Linha “fantasma” do Excel: sem matrícula/nome e só zeros ou células vazias
 * (comum abaixo dos dados reais quando a planilha foi exportada pelo sistema).
 */
export function isOrganicoImportGhostRow(row: OrganicoSheetRow | null | undefined): boolean {
  if (!Array.isArray(row)) return true;
  const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const nome = String(row[ORGANICO_IDX.NOME] ?? "").trim();
  if (matricula) return false;
  if (nome) return false;
  return row.every(isBlankOrZeroImportCell);
}

/** Linhas válidas para importação: matrícula preenchida e não é fantasma. */
export function filterImportableOrganicoRows(rows: OrganicoSheetRow[]): OrganicoSheetRow[] {
  return rows.filter((row): row is OrganicoSheetRow => {
    if (!Array.isArray(row)) return false;
    if (isOrganicoImportGhostRow(row)) return false;
    return String(row[ORGANICO_IDX.MATRICULA] ?? "").trim() !== "";
  });
}
