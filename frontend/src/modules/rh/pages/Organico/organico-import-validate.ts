import { normalizeMatriculaFolha } from "@rh/lib/api-client";
import { ORGANICO_IDX } from "./organico-derive";
import { ORGANICO_HEADERS } from "./organico-headers";
import type { OrganicoSheetRow } from "./useOrganicoImport";
import { buildFullImportChangeLog, type OrganicoImportChangeLogEntry } from "./organico-import-change-log";
import {
  buildMatriculaIndex,
  isSecullumProtectedRow,
  mergeImportByMatricula,
  resolveRowIndexByMatricula,
} from "./organico-import-merge";
import { filterImportableOrganicoRows } from "./organico-import-row-utils";

export type ValidationIssue = {
  code: string;
  message: string;
  matricula?: string;
  rowNumber?: number;
};

export type OrganicoImportValidationResult = {
  canImport: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  changeLog: OrganicoImportChangeLogEntry[];
  stats: {
    sheetRows: number;
    matched: number;
    unchanged: number;
    notInSheet: number;
    notInBase: number;
    duplicateMatriculas: number;
    totalFieldChanges: number;
    collaboratorsChanged: number;
  };
  proposedRows: OrganicoSheetRow[];
  columnMapWarnings: string[];
};

export type ValidateOrganicoImportInput = {
  baseRows: OrganicoSheetRow[];
  importedRows: OrganicoSheetRow[];
  columnMapWarnings?: string[];
  secullumMatriculaSet?: Set<string>;
  demissaoByMatricula?: Record<string, string>;
  isPartialExport?: boolean;
};

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function rowsEqual(a: OrganicoSheetRow, b: OrganicoSheetRow): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (String(a[i] ?? "").trim() !== String(b[i] ?? "").trim()) return false;
  }
  return true;
}

export function validateOrganicoImport(input: ValidateOrganicoImportInput): OrganicoImportValidationResult {
  const {
    baseRows,
    importedRows: rawImportedRows,
    columnMapWarnings = [],
    secullumMatriculaSet,
    demissaoByMatricula,
    isPartialExport = false,
  } = input;

  const importedRows = filterImportableOrganicoRows(rawImportedRows);

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const msg of columnMapWarnings) {
    warnings.push({ code: "column_map", message: msg });
  }

  if (isPartialExport) {
    warnings.push({
      code: "partial_export",
      message: "A exportação pode ter sido um recorte filtrado da tela. Colaboradores fora da planilha não serão alterados.",
    });
  }

  if (importedRows.length === 0) {
    errors.push({ code: "empty_sheet", message: "A planilha não contém linhas de dados." });
    return {
      canImport: false,
      errors,
      warnings,
      changeLog: [],
      stats: {
        sheetRows: 0,
        matched: 0,
        unchanged: baseRows.length,
        notInSheet: baseRows.length,
        notInBase: 0,
        duplicateMatriculas: 0,
        totalFieldChanges: 0,
        collaboratorsChanged: 0,
      },
      proposedRows: baseRows,
      columnMapWarnings,
    };
  }

  const baseIndex = buildMatriculaIndex(baseRows);
  const seenMatriculas = new Map<string, number>();
  let duplicateMatriculas = 0;
  let matched = 0;
  let notInBase = 0;

  importedRows.forEach((row, i) => {
    if (!Array.isArray(row)) return;
    const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const rowNumber = i + 2;
    if (!mat) return;

    const prev = seenMatriculas.get(mat);
    if (prev != null) {
      duplicateMatriculas += 1;
      errors.push({
        code: "duplicate_matricula",
        message: `Matrícula ${mat} aparece duplicada (linhas ${prev} e ${rowNumber}).`,
        matricula: mat,
        rowNumber,
      });
    } else {
      seenMatriculas.set(mat, rowNumber);
    }

    const idx = resolveRowIndexByMatricula(baseIndex, mat);
    if (idx == null) {
      notInBase += 1;
      errors.push({
        code: "matricula_not_in_base",
        message: `Matrícula ${mat} (linha ${rowNumber}) não existe na base atual do sistema.`,
        matricula: mat,
        rowNumber,
      });
      return;
    }

    matched += 1;
    const baseRow = baseRows[idx]!;
    const sheetName = String(row[ORGANICO_IDX.NOME] ?? "").trim();
    const baseName = String(baseRow[ORGANICO_IDX.NOME] ?? "").trim();
    if (sheetName && baseName && normalizeName(sheetName) !== normalizeName(baseName)) {
      warnings.push({
        code: "name_mismatch",
        message: `Matrícula ${mat}: nome na planilha ("${sheetName}") difere do sistema ("${baseName}").`,
        matricula: mat,
        rowNumber,
      });
    }
  });

  const proposedRows =
    baseRows.length === 0
      ? importedRows
      : mergeImportByMatricula(baseRows, importedRows, secullumMatriculaSet, demissaoByMatricula);

  const changeLog =
    baseRows.length === 0
      ? []
      : buildFullImportChangeLog(baseRows, proposedRows, (row) =>
          isSecullumProtectedRow(row, secullumMatriculaSet),
        );

  const changedMatriculas = new Set(changeLog.map((e) => e.matricula));
  let unchanged = 0;
  let notInSheet = 0;

  for (const row of baseRows) {
    if (!Array.isArray(row)) continue;
    const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!mat) continue;
    if (!seenMatriculas.has(mat)) {
      notInSheet += 1;
      continue;
    }
    const idx = resolveRowIndexByMatricula(baseIndex, mat);
    if (idx == null) continue;
    const proposed = proposedRows[idx];
    if (rowsEqual(row, proposed!)) unchanged += 1;
  }

  if (notInSheet > 0 && baseRows.length > 0) {
    warnings.push({
      code: "not_in_sheet",
      message: `${notInSheet} colaborador(es) da base não estão na planilha e permanecerão inalterados.`,
    });
  }

  if (changeLog.length === 0 && errors.length === 0 && baseRows.length > 0) {
    warnings.push({
      code: "no_changes",
      message: "Nenhuma alteração detectada em relação à base atual.",
    });
  }

  const canImport = errors.length === 0 && (baseRows.length === 0 ? importedRows.length > 0 : changeLog.length > 0);

  return {
    canImport,
    errors,
    warnings,
    changeLog,
    stats: {
      sheetRows: importedRows.length,
      matched,
      unchanged,
      notInSheet,
      notInBase,
      duplicateMatriculas,
      totalFieldChanges: changeLog.length,
      collaboratorsChanged: changedMatriculas.size,
    },
    proposedRows,
    columnMapWarnings,
  };
}

/** Ordena linhas por matrícula normalizada (ordem estável para exportação). */
export function sortRowsByMatricula(rows: OrganicoSheetRow[]): OrganicoSheetRow[] {
  return [...rows].sort((a, b) => {
    const ma = normalizeMatriculaFolha(String(a?.[ORGANICO_IDX.MATRICULA] ?? ""));
    const mb = normalizeMatriculaFolha(String(b?.[ORGANICO_IDX.MATRICULA] ?? ""));
    if (ma !== mb) return ma.localeCompare(mb, "pt-BR", { numeric: true });
    return String(a?.[ORGANICO_IDX.NOME] ?? "").localeCompare(String(b?.[ORGANICO_IDX.NOME] ?? ""), "pt-BR");
  });
}

export type { OrganicoExportMeta } from "./organico-import-meta";
export { buildExportMeta } from "./organico-import-meta";

export function formatValidationSummary(result: OrganicoImportValidationResult): string {
  const { stats } = result;
  const parts = [
    `${stats.sheetRows} linha(s) válida(s) (com matrícula)`,
    `${stats.collaboratorsChanged} colaborador(es) com alteração`,
    `${stats.totalFieldChanges} campo(s) alterado(s)`,
  ];
  if (result.errors.length > 0) parts.push(`${result.errors.length} erro(s)`);
  if (result.warnings.length > 0) parts.push(`${result.warnings.length} aviso(s)`);
  return parts.join(" · ");
}

export function getColumnLabel(colIndex: number): string {
  return String(ORGANICO_HEADERS[colIndex] ?? "").trim() || `Coluna ${colIndex + 1}`;
}
