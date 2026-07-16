import { normalizeMatriculaFolha } from "@rh/lib/api-client";
import { ORGANICO_IDX } from "./organico-derive";

type OrganicoSheetRow = (string | number)[];

/** Nome válido para aba do Excel (máx. 31 caracteres; sem \ / ? * [ ] :). */
export function sanitizeExcelSheetName(raw: string): string {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/[\\/*?:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fallback = cleaned || "Orgânico";
  return fallback.length > 31 ? fallback.slice(0, 31).trim() : fallback;
}

export type OrganicoExportMeta = {
  exportedAt: string;
  rowCount: number;
  matriculaHash: string;
  recorteFiltrado: boolean;
  baseTotalRows: number;
  /** Nome da guia de empresa no sistema (aba principal do arquivo exportado). */
  sheetName: string;
};

export function buildExportMeta(
  exportedRows: OrganicoSheetRow[],
  baseTotalRows: number,
  recorteFiltrado: boolean,
  empresaTabName: string,
): OrganicoExportMeta {
  const mats = exportedRows
    .map((r) => normalizeMatriculaFolha(String(r?.[ORGANICO_IDX.MATRICULA] ?? "")))
    .filter(Boolean)
    .sort();
  const matriculaHash = mats.join("|").slice(0, 64);
  return {
    exportedAt: new Date().toISOString(),
    rowCount: exportedRows.length,
    matriculaHash,
    recorteFiltrado,
    baseTotalRows,
    sheetName: sanitizeExcelSheetName(empresaTabName),
  };
}
