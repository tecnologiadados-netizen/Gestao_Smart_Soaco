import type { FaltaRow, SancaoDisciplinarRow } from "@rh/types/api";

const FALTAS_KEY = "rh_launch_test_faltas";
const SANCOES_KEY = "rh_launch_test_sancoes";

export const LAUNCH_TEST_RECORDS_CHANGED_EVENT = "rh-launch-test-records-changed";

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAUNCH_TEST_RECORDS_CHANGED_EVENT));
}

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(items));
  notifyChanged();
}

export function getTestFaltasRows(): FaltaRow[] {
  return readJson<FaltaRow>(FALTAS_KEY);
}

export function getTestSancoesRows(): SancaoDisciplinarRow[] {
  return readJson<SancaoDisciplinarRow>(SANCOES_KEY);
}

export function upsertTestFaltaRow(row: FaltaRow): void {
  const idStr = String(row.id);
  const items = getTestFaltasRows();
  const next = idStr.startsWith("temp-")
    ? [...items.filter((r) => String(r.id) !== idStr), row]
    : items.map((r) => (String(r.id) === idStr ? row : r));
  writeJson(FALTAS_KEY, next);
}

export function upsertTestSancaoRow(row: SancaoDisciplinarRow): void {
  const idStr = String(row.id);
  const items = getTestSancoesRows();
  const next = idStr.startsWith("temp-")
    ? [...items.filter((r) => String(r.id) !== idStr), row]
    : items.map((r) => (String(r.id) === idStr ? row : r));
  writeJson(SANCOES_KEY, next);
}

export function mergeTestFaltasIntoRows(rows: FaltaRow[]): FaltaRow[] {
  const testRows = getTestFaltasRows();
  if (testRows.length === 0) return rows;
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  for (const testRow of testRows) {
    byId.set(String(testRow.id), testRow);
  }
  return [...byId.values()];
}

export function mergeTestSancoesIntoRows(rows: SancaoDisciplinarRow[]): SancaoDisciplinarRow[] {
  const testRows = getTestSancoesRows();
  if (testRows.length === 0) return rows;
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  for (const testRow of testRows) {
    byId.set(String(testRow.id), testRow);
  }
  return [...byId.values()];
}

export function clearLaunchTestRecords(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FALTAS_KEY);
  window.sessionStorage.removeItem(SANCOES_KEY);
  notifyChanged();
}

export function removeTestFaltaRow(id: FaltaRow["id"]): void {
  const idStr = String(id);
  writeJson(
    FALTAS_KEY,
    getTestFaltasRows().filter((r) => String(r.id) !== idStr),
  );
}

export function removeTestSancaoRow(id: SancaoDisciplinarRow["id"]): void {
  const idStr = String(id);
  writeJson(
    SANCOES_KEY,
    getTestSancoesRows().filter((r) => String(r.id) !== idStr),
  );
}
