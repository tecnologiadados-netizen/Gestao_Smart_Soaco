/**
 * Normaliza a lista vinda da API get-organico.
 *
 * Problemas que costumam esvaziar colunas na exportação:
 * - Várias linhas com a mesma matrícula: antes ficávamos só com **uma** linha (a última),
 *   que muitas vezes é a mais “enxuta” (ex.: só Secullum), apagando dados da planilha.
 * - `values` vindo como objeto JSON `{ "0": "...", "1": "..." }` em vez de array.
 *
 * Regra: uma linha por matrícula; prioriza a linha mais recente e só completa lacunas
 * com valores não vazios das anteriores (evita "linha híbrida" com custos inconsistentes).
 */
import type { OrganicoRow } from "@rh/types/api";
import { ORGANICO_IDX } from "@rh/pages/Organico/organico-derive";
import { ORGANICO_NUM_COLUNAS } from "@rh/pages/Organico/organico-headers";
import { migrateOrganicoRowSchema } from "@rh/pages/Organico/organico-import-column-map";

/** Converte `values` do PostgREST/JSON em array de strings por índice. */
export function parseOrganicoValuesArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return migrateOrganicoRowSchema(raw.map((v) => (v == null ? "" : String(v)))) as string[];
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => Number(k));
    if (keys.length === 0) return [];
    const maxI = Math.max(...keys, ORGANICO_NUM_COLUNAS - 1);
    const out: string[] = [];
    for (let i = 0; i <= maxI; i++) {
      const v = o[String(i)];
      out.push(v == null ? "" : String(v));
    }
    return migrateOrganicoRowSchema(out) as string[];
  }
  return [];
}

function keyForParsedRow(values: string[], id: string, fallbackIndex: number): string {
  const mat = String(values[ORGANICO_IDX.MATRICULA] ?? "").trim();
  if (mat) return `mat:${mat}`;
  return `id:${String(id ?? fallbackIndex)}`;
}

export function rowHasNome(r: OrganicoRow): boolean {
  const vals = parseOrganicoValuesArray(r.values);
  return String(vals[ORGANICO_IDX.NOME] ?? "").trim() !== "";
}

/**
 * Mescla várias linhas do mesmo colaborador priorizando a mais recente:
 * - começa com a última linha da API (mais nova),
 * - percorre as anteriores e preenche apenas colunas vazias.
 */
function mergeDuplicateValueRows(rows: { id: string; values: string[] }[]): string[] {
  if (rows.length === 0) return new Array<string>(ORGANICO_NUM_COLUNAS).fill("");
  const latest = rows[rows.length - 1]?.values ?? [];
  const merged = new Array<string>(ORGANICO_NUM_COLUNAS).fill("");

  for (let i = 0; i < ORGANICO_NUM_COLUNAS; i++) {
    merged[i] = latest[i] != null ? String(latest[i]) : "";
  }

  for (let rowIndex = rows.length - 2; rowIndex >= 0; rowIndex--) {
    const v = rows[rowIndex]?.values ?? [];
    const len = Math.max(v.length, ORGANICO_NUM_COLUNAS);
    for (let i = 0; i < len; i++) {
      if (String(merged[i] ?? "").trim() !== "") continue;
      const s = String(v[i] ?? "").trim();
      if (s !== "") merged[i] = v[i] != null ? String(v[i]) : s;
    }
  }
  while (merged.length < ORGANICO_NUM_COLUNAS) merged.push("");
  return migrateOrganicoRowSchema(merged).slice(0, ORGANICO_NUM_COLUNAS) as string[];
}

export function normalizeOrganicoApiRows(rows: OrganicoRow[]): OrganicoRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const parsed = rows.map((r, i) => ({
    id: String(r.id ?? i),
    raw: r,
    values: parseOrganicoValuesArray(r.values),
  }));

  const groups = new Map<string, typeof parsed>();
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (!rowHasNome(p.raw)) continue;
    const key = keyForParsedRow(p.values, p.id, i);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const out: OrganicoRow[] = [];
  for (const [, list] of groups) {
    if (list.length === 0) continue;
    const mergedValues = mergeDuplicateValueRows(list.map((p) => ({ id: p.id, values: p.values })));
    const latest = list[list.length - 1];
    out.push({ id: latest.id, values: mergedValues });
  }

  return out;
}
