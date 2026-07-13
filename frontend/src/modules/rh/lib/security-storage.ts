export const RH_SESSION_CLEARED_EVENT = "rh-session-cleared";

const DEFAULT_SENSITIVE_BROWSER_KEYS = [
  "rh_authenticated",
  "rh_current_user",
  "rh_jwt",
  "rh_route_permissions",
  "rh_last_activity_at",
  "organico:representantes:drafts",
] as const;

const KNOWN_SENSITIVE_INDEXED_DB_NAMES = [
  "relatorios-dashboard-absences",
] as const;

function getBrowserStorage(kind: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Dados sensíveis devem sobreviver apenas à aba atual.
 * Também migra/remova resíduos legados que tenham sido gravados em localStorage.
 */
export function getEphemeralStorageItem(key: string): string | null {
  const session = getBrowserStorage("session");
  const local = getBrowserStorage("local");
  const current = session?.getItem(key) ?? null;
  if (current != null) return current;

  const legacy = local?.getItem(key) ?? null;
  if (legacy != null) {
    try {
      session?.setItem(key, legacy);
      local?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  return legacy;
}

export function setEphemeralStorageItem(key: string, value: string): void {
  const session = getBrowserStorage("session");
  const local = getBrowserStorage("local");
  try {
    session?.setItem(key, value);
    local?.removeItem(key);
  } catch {
    /* quota / modo privado */
  }
}

export function removeEphemeralStorageItem(key: string): void {
  try {
    getBrowserStorage("session")?.removeItem(key);
    getBrowserStorage("local")?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearSensitiveBrowserStorage(extraKeys: string[] = []): void {
  const keys = new Set<string>([...DEFAULT_SENSITIVE_BROWSER_KEYS, ...extraKeys]);
  for (const key of keys) {
    removeEphemeralStorageItem(key);
  }
  clearKnownSensitiveIndexedDb();
}

export function notifyRhSessionCleared(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RH_SESSION_CLEARED_EVENT));
}

function clearKnownSensitiveIndexedDb(): void {
  if (typeof indexedDB === "undefined") return;
  for (const dbName of KNOWN_SENSITIVE_INDEXED_DB_NAMES) {
    try {
      indexedDB.deleteDatabase(dbName);
    } catch {
      /* ignore */
    }
  }
}
