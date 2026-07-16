import { normalizeMatriculaFolha, secullumMatriculaSetMatchesOrganico } from "@rh/lib/api-client";
import { ORGANICO_IDX } from "./organico-derive";
import { ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { isColunaDerivadaSistema } from "./organico-excel-schema";
import { calcularFormulasRow } from "./organico-formulas";
import { ORGANICO_COLUNAS_READONLY_SECULLUM, ORGANICO_DETALHE_ORIGEM_API_SECULLUM } from "./organico-secullum-readonly";
import type { OrganicoSheetRow } from "./useOrganicoImport";

export function isSecullumProtectedRow(row: OrganicoSheetRow, secullumMatriculaSet?: Set<string>): boolean {
  const matricula = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
  if (matricula && secullumMatriculaSet && secullumMatriculaSetMatchesOrganico(secullumMatriculaSet, matricula)) {
    return true;
  }
  return String(row[ORGANICO_NUM_COLUNAS - 1] ?? "").trim() === ORGANICO_DETALHE_ORIGEM_API_SECULLUM;
}

export function mergeSingleImportedRowPreservingSecullum(
  baseRow: OrganicoSheetRow,
  importedRow: OrganicoSheetRow,
  secullumMatriculaSet?: Set<string>,
  demissaoByMatricula?: Record<string, string>,
): OrganicoSheetRow {
  const current = Array.isArray(baseRow) ? [...baseRow] : [];
  const incoming = Array.isArray(importedRow) ? [...importedRow] : [];
  while (current.length < ORGANICO_NUM_COLUNAS) current.push("");
  while (incoming.length < ORGANICO_NUM_COLUNAS) incoming.push("");

  const next = [...current];
  const preserveSecullum = isSecullumProtectedRow(current, secullumMatriculaSet);

  for (let colIndex = 0; colIndex < ORGANICO_NUM_COLUNAS; colIndex++) {
    if (isColunaDerivadaSistema(colIndex)) continue;
    if (preserveSecullum && ORGANICO_COLUNAS_READONLY_SECULLUM.has(colIndex)) continue;
    next[colIndex] = incoming[colIndex] ?? "";
  }

  calcularFormulasRow(next, { demissaoByMatricula });
  return next;
}

export type MatriculaIndex = {
  byMatricula: Map<string, number>;
  byCanon: Map<string, number>;
};

export function buildMatriculaIndex(rows: OrganicoSheetRow[]): MatriculaIndex {
  const byMatricula = new Map<string, number>();
  const byCanon = new Map<string, number>();
  rows.forEach((row, idx) => {
    if (!Array.isArray(row)) return;
    const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!mat) return;
    byMatricula.set(mat, idx);
    const canon = normalizeMatriculaFolha(mat);
    if (canon && canon !== "0") byCanon.set(canon, idx);
  });
  return { byMatricula, byCanon };
}

export function resolveRowIndexByMatricula(index: MatriculaIndex, matricula: string): number | undefined {
  const mat = String(matricula ?? "").trim();
  if (!mat) return undefined;
  const direct = index.byMatricula.get(mat);
  if (direct != null) return direct;
  const canon = normalizeMatriculaFolha(mat);
  if (canon && canon !== "0") return index.byCanon.get(canon);
  return undefined;
}

/** Mescla importação exclusivamente por matrícula — linhas da base ausentes na planilha permanecem intactas. */
export function mergeImportByMatricula(
  baseRows: OrganicoSheetRow[],
  importedRows: OrganicoSheetRow[],
  secullumMatriculaSet?: Set<string>,
  demissaoByMatricula?: Record<string, string>,
): OrganicoSheetRow[] {
  const index = buildMatriculaIndex(baseRows);
  const nextRows = [...baseRows];

  for (const importedRow of importedRows) {
    if (!Array.isArray(importedRow)) continue;
    const mat = String(importedRow[ORGANICO_IDX.MATRICULA] ?? "").trim();
    if (!mat) continue;
    const idx = resolveRowIndexByMatricula(index, mat);
    if (idx == null) continue;
    const baseRow = nextRows[idx];
    if (!Array.isArray(baseRow)) continue;
    nextRows[idx] = mergeSingleImportedRowPreservingSecullum(
      baseRow,
      importedRow,
      secullumMatriculaSet,
      demissaoByMatricula,
    );
  }

  return nextRows;
}
