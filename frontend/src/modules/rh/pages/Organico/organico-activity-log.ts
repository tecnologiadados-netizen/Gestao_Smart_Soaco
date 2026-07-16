import { normalizeMatriculaFolha } from "@rh/lib/api-client";
import { ORGANICO_HEADERS } from "./organico-headers";
import { getOrganicoCellDisplayValue } from "./organico-display";
import { isColunaDerivadaSistema, isColunaFormula } from "./organico-excel-schema";
import { ORGANICO_IDX } from "./organico-derive";
import type { OrganicoSheetRow } from "./useOrganicoImport";

export type OrganicoSecullumPendenciaTipo = "ctps" | "cargo";

export type OrganicoActivityEntryType = "comentario" | "log_alteracao";

export type OrganicoActivityCategory =
  | "geral"
  | "cargo_trabalho"
  | "beneficios"
  | "remuneracao"
  | "dados_bancarios"
  | "contrato";

export interface OrganicoActivityDraft {
  tipo: OrganicoActivityEntryType;
  categoria: OrganicoActivityCategory;
  comentario: string;
  campoAlterado?: string | null;
  valorAnterior?: string | null;
  valorAtual?: string | null;
}

const LOG_GROUPS: Array<{
  categoria: Exclude<OrganicoActivityCategory, "geral">;
  abaLabel: string;
  indices: number[];
}> = [
  { categoria: "cargo_trabalho", abaLabel: "Cargo e Trabalho", indices: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { categoria: "beneficios", abaLabel: "Benefícios", indices: [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52] },
  {
    categoria: "remuneracao",
    abaLabel: "Remuneração",
    indices: [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
  },
  { categoria: "dados_bancarios", abaLabel: "Dados Bancários", indices: [76, 77, 78, 79, 80] },
  { categoria: "contrato", abaLabel: "Contrato", indices: [81, 82, 83, 84, 85, 86] },
];

function normalizeCellValue(value: unknown): string {
  return String(value ?? "").trim();
}

function formatCellValue(index: number, value: unknown): string {
  const formatted = getOrganicoCellDisplayValue(index, value).trim();
  return formatted || "-";
}

function getStatusLogValue(row: OrganicoSheetRow | null | undefined): string {
  if (!Array.isArray(row)) return "-";
  const detalhe = String(row[ORGANICO_IDX.SITUACAO_TRABALHISTA] ?? "").trim();
  if (detalhe) return detalhe;
  return formatCellValue(ORGANICO_IDX.STATUS, row[ORGANICO_IDX.STATUS]);
}

export function buildOrganicoActivityLogs(previousRow: OrganicoSheetRow | null | undefined, nextRow: OrganicoSheetRow): OrganicoActivityDraft[] {
  if (!Array.isArray(previousRow) || !Array.isArray(nextRow)) return [];

  const logs: OrganicoActivityDraft[] = [];
  const statusChanged =
    normalizeCellValue(previousRow[ORGANICO_IDX.STATUS]) !== normalizeCellValue(nextRow[ORGANICO_IDX.STATUS]) ||
    normalizeCellValue(previousRow[ORGANICO_IDX.SITUACAO_TRABALHISTA]) !== normalizeCellValue(nextRow[ORGANICO_IDX.SITUACAO_TRABALHISTA]);

  for (const group of LOG_GROUPS) {
    for (const index of group.indices) {
      if (isColunaDerivadaSistema(index)) continue;
      if (index === ORGANICO_IDX.SITUACAO_TRABALHISTA) continue;
      if (index === ORGANICO_IDX.STATUS && statusChanged) {
        logs.push({
          tipo: "log_alteracao",
          categoria: group.categoria,
          comentario: `Status Funcionário (Secullum) alterado de ${getStatusLogValue(previousRow)} para ${getStatusLogValue(nextRow)}.`,
          campoAlterado: "Status Funcionário (Secullum)",
          valorAnterior: getStatusLogValue(previousRow),
          valorAtual: getStatusLogValue(nextRow),
        });
        continue;
      }

      const beforeValue = normalizeCellValue(previousRow[index]);
      const afterValue = normalizeCellValue(nextRow[index]);
      if (beforeValue === afterValue) continue;

      const campoAlterado = String(ORGANICO_HEADERS[index] ?? "").trim() || `Coluna ${index + 1}`;
      const valorAnterior = formatCellValue(index, previousRow[index]);
      const valorAtual = formatCellValue(index, nextRow[index]);

      logs.push({
        tipo: "log_alteracao",
        categoria: group.categoria,
        comentario: `${campoAlterado} alterado de ${valorAnterior} para ${valorAtual}.`,
        campoAlterado,
        valorAnterior,
        valorAtual,
      });
    }
  }

  return logs;
}

const SECULLUM_PENDENCIA_INDICES: Array<{ idx: number; tipo: OrganicoSecullumPendenciaTipo }> = [
  { idx: ORGANICO_IDX.CARGO, tipo: "cargo" },
  { idx: ORGANICO_IDX.CTPS, tipo: "ctps" },
];

/** Campos CTPS/cargo alterados no merge Secullum — para criar/atualizar pendências de justificativa no backend. */
export function collectSecullumPendingFieldChanges(
  previousRow: OrganicoSheetRow | null | undefined,
  nextRow: OrganicoSheetRow,
): Array<{
  tipo: OrganicoSecullumPendenciaTipo;
  campoLabel: string;
  valorAnterior: string;
  valorAtual: string;
}> {
  if (!Array.isArray(previousRow) || !Array.isArray(nextRow)) return [];

  const out: Array<{
    tipo: OrganicoSecullumPendenciaTipo;
    campoLabel: string;
    valorAnterior: string;
    valorAtual: string;
  }> = [];

  for (const { idx, tipo } of SECULLUM_PENDENCIA_INDICES) {
    if (isColunaFormula(idx)) continue;
    const beforeValue = normalizeCellValue(previousRow[idx]);
    const afterValue = normalizeCellValue(nextRow[idx]);
    if (beforeValue === afterValue) continue;

    const campoAlterado = String(ORGANICO_HEADERS[idx] ?? "").trim() || `Coluna ${idx + 1}`;
    const valorAnterior = formatCellValue(idx, previousRow[idx]);
    const valorAtual = formatCellValue(idx, nextRow[idx]);

    out.push({
      tipo,
      campoLabel: campoAlterado,
      valorAnterior,
      valorAtual,
    });
  }

  return out;
}

function rowsHaveSameValues(a: OrganicoSheetRow | null | undefined, b: OrganicoSheetRow | null | undefined): boolean {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (String(a[i] ?? "") !== String(b[i] ?? "")) return false;
  }
  return true;
}

function matriculaKeyFromRow(row: OrganicoSheetRow | null | undefined): string {
  if (!Array.isArray(row)) return "";
  return normalizeMatriculaFolha(String(row[ORGANICO_IDX.MATRICULA] ?? ""));
}

function buildPrevRowsByMatricula(prevRows: OrganicoSheetRow[]): Map<string, OrganicoSheetRow> {
  const map = new Map<string, OrganicoSheetRow>();
  for (const row of prevRows) {
    if (!Array.isArray(row)) continue;
    const key = matriculaKeyFromRow(row);
    if (!key || key === "0") continue;
    map.set(key, row);
  }
  return map;
}

function findPreviousRowWithoutMatricula(
  prevRows: OrganicoSheetRow[],
  nextRow: OrganicoSheetRow,
): OrganicoSheetRow | null {
  const nome = String(nextRow[ORGANICO_IDX.NOME] ?? "").trim();
  if (!nome) return null;
  const setor = String(nextRow[ORGANICO_IDX.SETOR] ?? "").trim();
  for (const row of prevRows) {
    if (!Array.isArray(row)) continue;
    if (matriculaKeyFromRow(row)) continue;
    if (String(row[ORGANICO_IDX.NOME] ?? "").trim() !== nome) continue;
    if (setor && String(row[ORGANICO_IDX.SETOR] ?? "").trim() !== setor) continue;
    return row;
  }
  return null;
}

/**
 * Compara linhas antes/depois da sync Secullum por matrícula (não por índice da lista).
 * Evita falsos positivos quando linhas são removidas ou reordenadas após o merge.
 */
export function collectSecullumSyncChanges(
  prevRows: OrganicoSheetRow[],
  nextRows: OrganicoSheetRow[],
): Array<{
  previousRow: OrganicoSheetRow | null;
  nextRow: OrganicoSheetRow;
  activityLogs: OrganicoActivityDraft[];
}> {
  const prevByMatricula = buildPrevRowsByMatricula(prevRows);
  const changes: Array<{
    previousRow: OrganicoSheetRow | null;
    nextRow: OrganicoSheetRow;
    activityLogs: OrganicoActivityDraft[];
  }> = [];

  for (const nextRow of nextRows) {
    if (!Array.isArray(nextRow)) continue;
    const key = matriculaKeyFromRow(nextRow);
    const previousRow = key && key !== "0"
      ? (prevByMatricula.get(key) ?? null)
      : findPreviousRowWithoutMatricula(prevRows, nextRow);
    if (rowsHaveSameValues(previousRow, nextRow)) continue;

    changes.push({
      previousRow,
      nextRow,
      activityLogs: buildOrganicoActivityLogs(previousRow, nextRow),
    });
  }

  return changes;
}

export function getOrganicoActivityCategoryLabel(category: OrganicoActivityCategory | null | undefined): string {
  switch (category) {
    case "cargo_trabalho":
      return "Cargo e Trabalho";
    case "beneficios":
      return "Benefícios";
    case "remuneracao":
      return "Remuneração";
    case "dados_bancarios":
      return "Dados Bancários";
    case "contrato":
      return "Contrato";
    default:
      return "Geral";
  }
}
