const STORAGE_PREFIX = 'gestor_ultima_atividade:';

function storageKey(login: string): string {
  return `${STORAGE_PREFIX}${login.trim().toLowerCase()}`;
}

/** Registra interação do usuário (persistido entre recarregamentos do navegador). */
export function touchLastActivity(login: string): void {
  if (!login.trim()) return;
  try {
    localStorage.setItem(storageKey(login), String(Date.now()));
  } catch {
    // storage indisponível
  }
}

export function clearLastActivity(login: string | null | undefined): void {
  if (!login?.trim()) return;
  try {
    localStorage.removeItem(storageKey(login));
  } catch {
    // storage indisponível
  }
}

export function getLastActivityMs(login: string): number | null {
  if (!login.trim()) return null;
  try {
    const raw = localStorage.getItem(storageKey(login));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function isSessaoInatividadeExpirada(login: string, minutos: number): boolean {
  if (minutos < 1 || !login.trim()) return false;
  const last = getLastActivityMs(login);
  if (last == null) return false;
  return Date.now() - last > minutos * 60 * 1000;
}

export function msRestantesInatividade(login: string, minutos: number): number {
  const timeoutMs = minutos * 60 * 1000;
  const last = getLastActivityMs(login);
  if (last == null) return timeoutMs;
  return Math.max(0, timeoutMs - (Date.now() - last));
}
