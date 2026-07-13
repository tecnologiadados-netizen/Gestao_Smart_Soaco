import { apiJson, getStoredToken } from '@/api/client';
import { buildDefaultGroupPermissions, normalizeGroupPermissions, type RhGroupPermissions } from '@rh/lib/rh-permissions';
import type { UserPermission } from '@rh/lib/config';

let cachedPermissions: RhGroupPermissions | null = null;
let cachedIsRhMaster = false;
let cachedUsername: string | null = null;

export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

/** Carrega permissões granulares do RH a partir do backend Gestor. */
export async function loadRhSessionPermissions(isGestorMaster: boolean, gestorLogin: string | null): Promise<void> {
  cachedIsRhMaster = isGestorMaster;
  cachedUsername = gestorLogin;
  if (!getStoredToken()) {
    cachedPermissions = null;
    return;
  }
  if (isGestorMaster) {
    cachedPermissions = null;
    return;
  }
  try {
    const json = await apiJson<{ permissions?: RhGroupPermissions; master?: boolean }>('/api/rh/rh-session-permissions');
    if (json.master) {
      cachedIsRhMaster = true;
      cachedPermissions = null;
      return;
    }
    if (json.permissions) {
      cachedPermissions = normalizeGroupPermissions(json.permissions);
      return;
    }
    cachedPermissions = buildDefaultGroupPermissions();
  } catch {
    cachedPermissions = null;
  }
}

export function setCachedGroupPermissions(permissions: RhGroupPermissions): void {
  if (cachedIsRhMaster) return;
  cachedPermissions = normalizeGroupPermissions(permissions);
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

export function getRhSessionToken(): string | null {
  return getStoredToken();
}

export function getCurrentUser(): string | null {
  return cachedUsername;
}

export function isMaster(): boolean {
  return cachedIsRhMaster;
}

export function getEffectiveGroupPermissions(): RhGroupPermissions | null {
  if (cachedIsRhMaster) return null;
  return cachedPermissions;
}

export function getEffectiveUserPermissions(): UserPermission[] | null {
  const permissions = getEffectiveGroupPermissions();
  return permissions?.routes ?? null;
}

export function getActiveUserPermissionCount(): number {
  const perms = getEffectiveUserPermissions();
  if (!perms) return 0;
  return perms.filter((p) => p.canView || p.canEdit).length;
}

export function touchRhSessionActivity(): void {
  /* inatividade gerenciada pelo Gestor */
}

export function isRhSessionInactive(): boolean {
  return false;
}

export function hasStoredRhSession(): boolean {
  return isAuthenticated();
}

export function logout(): void {
  cachedPermissions = null;
  cachedIsRhMaster = false;
  cachedUsername = null;
}

/** Legado — não usado no módulo embutido. */
export function setSessionFromApiLogin(_result: unknown): void {}
export function setSessionFromMockLogin(_username: string, _permissions: unknown): void {}
export function setCurrentUser(username: string): void {
  cachedUsername = username;
}
