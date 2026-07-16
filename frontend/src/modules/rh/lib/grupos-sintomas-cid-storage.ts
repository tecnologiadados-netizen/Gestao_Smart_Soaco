import { readPersistedJson, writePersistedJson } from "@rh/lib/ui-filter-persistence";
import {
  buildGruposSintomasCidDefault,
  isGrupoSintomasCustomizado,
  remontarGruposSintomasLegados,
} from "@rh/lib/grupos-sintomas-cid-default";
import {
  GRUPO_SINTOMA_CATALOGO_IDS,
  grupoSintomasUsaCatalogoLegado,
  ID_CAPITULOS_AGREGADOS,
  tituloGrupoPrecisaReparo,
  tituloGrupoSintoma,
} from "@rh/lib/grupos-sintomas-cid-titulos";
import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";
import { getConfig, isApiConfigured, setConfig } from "@rh/lib/api-client";

const STORAGE_KEY = "rh-faltas-grupos-sintomas-v5";
const CONFIG_KEY = "faltas_grupos_sintomas_cid_v5";

const LEGACY_KEYS = [
  "rh-faltas-grupos-sintomas-v4",
  "rh-faltas-grupos-sintomas-v3",
  "rh-faltas-grupos-sintomas-v2",
  "rh-faltas-grupos-sintomas-v1",
] as const;

export const GRUPOS_SINTOMAS_CHANGED_EVENT = "rh-grupos-sintomas-changed";

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GRUPOS_SINTOMAS_CHANGED_EVENT));
}

function normalizeGrupo(raw: unknown, index: number): FaltaGrupoSintomaCidRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const titulo = String(o.titulo ?? "").trim();
  if (!id || !titulo) return null;
  const cidsRaw = Array.isArray(o.cids) ? o.cids : [];
  const cids = cidsRaw
    .map((c) => String(c).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return {
    id,
    ordem: typeof o.ordem === "number" && Number.isFinite(o.ordem) ? o.ordem : index + 1,
    titulo,
    cids,
  };
}

function readRawFromKeys(keys: readonly string[]): FaltaGrupoSintomaCidRow[] | null {
  for (const key of keys) {
    const saved = readPersistedJson<FaltaGrupoSintomaCidRow[]>(key, "local");
    if (!saved?.length) continue;
    const normalized = saved
      .map((g, i) => normalizeGrupo(g, i))
      .filter((g): g is FaltaGrupoSintomaCidRow => g != null)
      .sort((a, b) => a.ordem - b.ordem);
    if (normalized.length) return normalized;
  }
  return null;
}

function writeLocal(grupos: FaltaGrupoSintomaCidRow[]): void {
  const next = grupos
    .map((g, i) => ({
      ...g,
      ordem: i + 1,
      titulo: g.titulo.trim(),
      cids: g.cids.map((c) => c.trim()).filter(Boolean),
    }))
    .filter((g) => g.titulo);
  writePersistedJson(STORAGE_KEY, next, "local");
  notifyChanged();
}

function repairTitulosGrupos(grupos: FaltaGrupoSintomaCidRow[]): FaltaGrupoSintomaCidRow[] {
  return grupos.map((g) => ({
    ...g,
    titulo: tituloGrupoPrecisaReparo(g.titulo) ? tituloGrupoSintoma(g.id, g.titulo) : g.titulo,
  }));
}

function precisaMigrarCatalogo(grupos: FaltaGrupoSintomaCidRow[]): boolean {
  if (grupos.some((g) => grupoSintomasUsaCatalogoLegado(g.id))) return true;
  const padrao = grupos.filter((g) => !isGrupoSintomasCustomizado(g.id));
  if (padrao.some((g) => g.id === ID_CAPITULOS_AGREGADOS)) return true;
  const ids = new Set(padrao.map((g) => g.id));
  return GRUPO_SINTOMA_CATALOGO_IDS.some((id) => !ids.has(id));
}

function parseGruposPayload(raw: unknown): FaltaGrupoSintomaCidRow[] | null {
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((g, i) => normalizeGrupo(g, i))
      .filter((g): g is FaltaGrupoSintomaCidRow => g != null)
      .sort((a, b) => a.ordem - b.ordem);
    return normalized.length ? normalized : null;
  }
  if (raw && typeof raw === "object") {
    const grupos = (raw as Record<string, unknown>).grupos;
    return parseGruposPayload(grupos);
  }
  return null;
}

async function readRemoteGrupos(): Promise<FaltaGrupoSintomaCidRow[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const { value } = await getConfig(CONFIG_KEY);
    if (!value?.trim()) return null;
    return parseGruposPayload(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

async function writeRemoteGrupos(grupos: FaltaGrupoSintomaCidRow[]): Promise<void> {
  if (!isApiConfigured()) return;
  await setConfig(
    CONFIG_KEY,
    JSON.stringify({
      version: 5,
      grupos: grupos.map((g, i) => ({
        id: g.id,
        ordem: i + 1,
        titulo: g.titulo,
        cids: g.cids,
      })),
    }),
  );
}

function readLocal(): FaltaGrupoSintomaCidRow[] | null {
  const current = readRawFromKeys([STORAGE_KEY]);
  if (current?.length) {
    if (precisaMigrarCatalogo(current)) {
      return remontarGruposSintomasLegados(current);
    }
    return current;
  }
  const legacy = readRawFromKeys(LEGACY_KEYS);
  if (!legacy?.length) return null;
  return remontarGruposSintomasLegados(legacy);
}

export async function getFaltasGruposSintomasCid(): Promise<FaltaGrupoSintomaCidRow[]> {
  const remote = await readRemoteGrupos();
  if (remote?.length) {
    const migrated = precisaMigrarCatalogo(remote) ? remontarGruposSintomasLegados(remote) : remote;
    const repaired = repairTitulosGrupos(migrated);
    writeLocal(repaired);
    if (JSON.stringify(repaired) !== JSON.stringify(remote)) {
      void writeRemoteGrupos(repaired);
    }
    return repaired;
  }

  const rawV5 = readRawFromKeys([STORAGE_KEY]);
  const source = rawV5?.length ? rawV5 : readRawFromKeys(LEGACY_KEYS);

  if (source?.length) {
    const migrated = precisaMigrarCatalogo(source) ? remontarGruposSintomasLegados(source) : source;
    const repaired = repairTitulosGrupos(migrated);
    if (!rawV5?.length || precisaMigrarCatalogo(source) || JSON.stringify(repaired) !== JSON.stringify(rawV5)) {
      writeLocal(repaired);
    }
    void writeRemoteGrupos(repaired);
    return repaired;
  }

  const defaults = buildGruposSintomasCidDefault();
  writeLocal(defaults);
  void writeRemoteGrupos(defaults);
  return defaults;
}

export async function replaceFaltasGruposSintomasCid(
  grupos: FaltaGrupoSintomaCidRow[],
): Promise<FaltaGrupoSintomaCidRow[]> {
  writeLocal(grupos);
  await writeRemoteGrupos(grupos);
  return getFaltasGruposSintomasCid();
}
