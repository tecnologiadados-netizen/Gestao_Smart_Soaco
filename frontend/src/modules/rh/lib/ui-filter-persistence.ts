export type PersistedStorageKind = "session" | "local";

function getStorage(kind: PersistedStorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPersistedJson<T>(key: string, kind: PersistedStorageKind = "session"): T | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writePersistedJson(key: string, value: unknown, kind: PersistedStorageKind = "session"): void {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / modo privado */
  }
}

export function clearPersistedKey(key: string, kind: PersistedStorageKind = "session"): void {
  const storage = getStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
