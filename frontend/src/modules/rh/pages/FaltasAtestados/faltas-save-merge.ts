import type { FaltaRow } from "@rh/types/api";

const CLIENT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Incluir linha local no replace: temp, UUID novo ou registro já existente no servidor. */
export function shouldMergeVisibleRowIntoServerSnapshot(rowId: string, serverIds: Set<string>): boolean {
  const key = String(rowId ?? "").trim();
  if (!key || key.startsWith("import-")) return false;
  if (key.startsWith("temp-")) return true;
  if (serverIds.has(key)) return true;
  return CLIENT_UUID_RE.test(key);
}

/** Chave estável para detectar o mesmo lançamento com IDs de cliente diferentes. */
export function faltaDedupeKey(
  row: Pick<FaltaRow, "matricula" | "data" | "tipo" | "periodo" | "qntd">,
): string {
  return [
    String(row.matricula ?? "").trim(),
    String(row.data ?? "").trim().slice(0, 10),
    String(row.tipo ?? "").trim(),
    String(row.periodo ?? "").trim(),
    String(row.qntd ?? "").trim(),
  ]
    .join("|")
    .toLowerCase();
}

/**
 * Mescla linha da grade no snapshot do servidor.
 * Se o ID é UUID novo e já existe registro equivalente (matrícula+data+tipo…), reutiliza o ID existente
 * em vez de inserir duplicata — protege contra duplo clique / UUID regenerado.
 */
export function reconcileVisibleRowIntoMap(
  map: Map<string, FaltaRow>,
  row: FaltaRow,
  serverIds: Set<string>,
): void {
  const key = String(row.id);
  if (!shouldMergeVisibleRowIntoServerSnapshot(key, serverIds)) return;

  if (CLIENT_UUID_RE.test(key)) {
    const dk = faltaDedupeKey(row);
    for (const [existingId, existing] of map) {
      if (existingId === key) continue;
      if (faltaDedupeKey(existing) === dk) {
        map.set(existingId, { ...row, id: existing.id });
        return;
      }
    }
  }

  map.set(key, row);
}
