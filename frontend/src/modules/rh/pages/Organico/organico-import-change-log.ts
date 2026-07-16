import { ORGANICO_HEADERS } from "./organico-headers";
import { getOrganicoCellDisplayValue } from "./organico-display";
import { isColunaDerivadaSistema } from "./organico-excel-schema";
import { ORGANICO_IDX } from "./organico-derive";
import type { OrganicoActivityDraft, OrganicoActivityCategory } from "./organico-activity-log";
import type { OrganicoSheetRow } from "./useOrganicoImport";
import { ORGANICO_COLUNAS_READONLY_SECULLUM } from "./organico-secullum-readonly";

export type OrganicoImportChangeLogEntry = {
  matricula: string;
  colaboradorNome: string;
  setor: string;
  colunaAlterada: string;
  antes: string;
  depois: string;
  colIndex: number;
};

const CATEGORY_BY_INDEX = new Map<number, OrganicoActivityCategory>();
const LOG_GROUP_INDICES: Array<{ categoria: OrganicoActivityCategory; indices: number[] }> = [
  { categoria: "cargo_trabalho", indices: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { categoria: "beneficios", indices: [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52] },
  { categoria: "remuneracao", indices: [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75] },
  { categoria: "dados_bancarios", indices: [76, 77, 78, 79, 80] },
  { categoria: "contrato", indices: [81, 82, 83, 84, 85, 86] },
];

for (const group of LOG_GROUP_INDICES) {
  for (const idx of group.indices) {
    CATEGORY_BY_INDEX.set(idx, group.categoria);
  }
}

function normalizeCellValue(value: unknown): string {
  return String(value ?? "").trim();
}

function formatCellValue(index: number, value: unknown): string {
  const formatted = getOrganicoCellDisplayValue(index, value).trim();
  return formatted || "-";
}

function getStatusLogValue(row: OrganicoSheetRow): string {
  const detalhe = String(row[ORGANICO_IDX.SITUACAO_TRABALHISTA] ?? "").trim();
  if (detalhe) return detalhe;
  return formatCellValue(ORGANICO_IDX.STATUS, row[ORGANICO_IDX.STATUS]);
}

function shouldSkipColumnForDiff(colIndex: number, preserveSecullum: boolean): boolean {
  if (isColunaDerivadaSistema(colIndex)) return true;
  if (preserveSecullum && ORGANICO_COLUNAS_READONLY_SECULLUM.has(colIndex)) return true;
  return false;
}

/** Compara base vs linha mesclada e gera entradas do log (1 por campo alterado). */
export function buildImportChangeLog(
  baseRow: OrganicoSheetRow,
  mergedRow: OrganicoSheetRow,
  preserveSecullum: boolean,
): OrganicoImportChangeLogEntry[] {
  if (!Array.isArray(baseRow) || !Array.isArray(mergedRow)) return [];

  const matricula = String(mergedRow[ORGANICO_IDX.MATRICULA] ?? baseRow[ORGANICO_IDX.MATRICULA] ?? "").trim();
  const colaboradorNome = String(mergedRow[ORGANICO_IDX.NOME] ?? baseRow[ORGANICO_IDX.NOME] ?? "").trim() || "-";
  const setor = String(mergedRow[ORGANICO_IDX.SETOR] ?? baseRow[ORGANICO_IDX.SETOR] ?? "").trim() || "-";

  const entries: OrganicoImportChangeLogEntry[] = [];
  const statusChanged =
    normalizeCellValue(baseRow[ORGANICO_IDX.STATUS]) !== normalizeCellValue(mergedRow[ORGANICO_IDX.STATUS]) ||
    normalizeCellValue(baseRow[ORGANICO_IDX.SITUACAO_TRABALHISTA]) !== normalizeCellValue(mergedRow[ORGANICO_IDX.SITUACAO_TRABALHISTA]);

  for (let colIndex = 0; colIndex < ORGANICO_HEADERS.length; colIndex++) {
    if (shouldSkipColumnForDiff(colIndex, preserveSecullum)) continue;
    if (colIndex === ORGANICO_IDX.SITUACAO_TRABALHISTA) continue;

    if (colIndex === ORGANICO_IDX.STATUS && statusChanged) {
      entries.push({
        matricula,
        colaboradorNome,
        setor,
        colunaAlterada: "Status Funcionário (Secullum)",
        antes: getStatusLogValue(baseRow),
        depois: getStatusLogValue(mergedRow),
        colIndex,
      });
      continue;
    }

    const beforeValue = normalizeCellValue(baseRow[colIndex]);
    const afterValue = normalizeCellValue(mergedRow[colIndex]);
    if (beforeValue === afterValue) continue;

    const colunaAlterada = String(ORGANICO_HEADERS[colIndex] ?? "").trim() || `Coluna ${colIndex + 1}`;
    entries.push({
      matricula,
      colaboradorNome,
      setor,
      colunaAlterada,
      antes: formatCellValue(colIndex, baseRow[colIndex]),
      depois: formatCellValue(colIndex, mergedRow[colIndex]),
      colIndex,
    });
  }

  return entries;
}

export function buildFullImportChangeLog(
  baseRows: OrganicoSheetRow[],
  proposedRows: OrganicoSheetRow[],
  isSecullumProtected: (row: OrganicoSheetRow) => boolean,
): OrganicoImportChangeLogEntry[] {
  const all: OrganicoImportChangeLogEntry[] = [];
  for (let i = 0; i < baseRows.length; i++) {
    const base = baseRows[i];
    const merged = proposedRows[i];
    if (!Array.isArray(base) || !Array.isArray(merged)) continue;
    all.push(...buildImportChangeLog(base, merged, isSecullumProtected(base)));
  }
  return all.sort((a, b) => {
    const nameCmp = a.colaboradorNome.localeCompare(b.colaboradorNome, "pt-BR");
    if (nameCmp !== 0) return nameCmp;
    return a.colIndex - b.colIndex;
  });
}

export function changeLogEntryToActivityDraft(entry: OrganicoImportChangeLogEntry): OrganicoActivityDraft {
  const categoria = CATEGORY_BY_INDEX.get(entry.colIndex) ?? "geral";
  const setorLabel = entry.setor && entry.setor !== "-" ? entry.setor : "—";
  return {
    tipo: "log_alteracao",
    categoria,
    comentario: `[Setor: ${setorLabel}] Importação Excel — ${entry.colunaAlterada} alterado de ${entry.antes} para ${entry.depois}.`,
    campoAlterado: entry.colunaAlterada,
    valorAnterior: entry.antes,
    valorAtual: entry.depois,
  };
}

export function groupChangeLogByMatricula(
  changeLog: OrganicoImportChangeLogEntry[],
): Map<string, OrganicoImportChangeLogEntry[]> {
  const map = new Map<string, OrganicoImportChangeLogEntry[]>();
  for (const entry of changeLog) {
    const key = entry.matricula || entry.colaboradorNome;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function exportChangeLogCsv(changeLog: OrganicoImportChangeLogEntry[]): string {
  const header = "Nome do colaborador;Setor;Coluna alterada;Antes;Depois";
  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = changeLog.map(
    (e) =>
      [escape(e.colaboradorNome), escape(e.setor), escape(e.colunaAlterada), escape(e.antes), escape(e.depois)].join(";"),
  );
  return [header, ...lines].join("\r\n");
}

export function downloadChangeLogCsv(changeLog: OrganicoImportChangeLogEntry[], filename = "organico-import-log.csv"): void {
  const csv = exportChangeLogCsv(changeLog);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
