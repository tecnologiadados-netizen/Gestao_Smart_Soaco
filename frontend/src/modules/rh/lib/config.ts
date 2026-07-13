/**
 * Configurações do sistema: logo em localStorage; usuários e grupos em localStorage
 * apenas quando `VITE_API_URL` não está definida. Com API, tudo vem do banco.
 */

import { randomUUID } from "@rh/lib/utils";
import {
  buildDefaultGroupPermissions,
  getRoutePermissions,
  normalizeGroupPermissions,
  type LegacyRoutePermission,
  type RhGroupPermissions,
} from "@rh/lib/rh-permissions";

export const LOGO_KEY = "rh_custom_logo";
export const USERS_KEY = "rh_system_users";
export const USER_GROUPS_KEY = "rh_user_groups";
export const CONFIG_PREFIX = "rh_config:";

export interface UserPermission extends LegacyRoutePermission {}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: RhGroupPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface SystemUser {
  id: string;
  username: string;
  passwordHash: string; // hash simples para demo (não usar em produção real)
  groupId: string;
  createdAt: string;
}

type LegacySystemUser = SystemUser & {
  permissions?: UserPermission[];
};

function parseStorageArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveStorageArray<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

export function getLocalConfigValue(key: string): string | null {
  return localStorage.getItem(`${CONFIG_PREFIX}${key}`);
}

export function setLocalConfigValue(key: string, value: string): void {
  localStorage.setItem(`${CONFIG_PREFIX}${key}`, value);
  window.dispatchEvent(new CustomEvent("rh-config-updated", { detail: { key } }));
}

export function buildDefaultPermissions(): UserPermission[] {
  return getRoutePermissions(buildDefaultGroupPermissions());
}

export function buildDefaultGroupPermissionsConfig(): RhGroupPermissions {
  return buildDefaultGroupPermissions();
}

/** Retorna a URL da logo customizada (base64) ou null. */
export function getCustomLogo(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

/** Salva a logo em base64. */
export function setCustomLogo(base64: string): void {
  localStorage.setItem(LOGO_KEY, base64);
  window.dispatchEvent(new CustomEvent("rh-logo-updated"));
}

/** Remove a logo customizada. */
export function clearCustomLogo(): void {
  localStorage.removeItem(LOGO_KEY);
  window.dispatchEvent(new CustomEvent("rh-logo-updated"));
}

/** Hash simples para senha (apenas para demo - NÃO usar em produção). */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return String(h);
}

function normalizeGroup(group: Partial<UserGroup>): UserGroup {
  return {
    id: String(group.id ?? randomUUID()),
    name: String(group.name ?? "").trim(),
    description: String(group.description ?? ""),
    permissions: normalizeGroupPermissions(group.permissions),
    createdAt: String(group.createdAt ?? new Date().toISOString()),
    updatedAt: String(group.updatedAt ?? new Date().toISOString()),
  };
}

function ensureDefaultGroup(groups: UserGroup[], users: SystemUser[]): UserGroup[] {
  if (groups.length > 0) return groups;
  const legacyUser = users.find((user) => Array.isArray((user as LegacySystemUser).permissions)) as LegacySystemUser | undefined;
  const legacyPermissions = normalizeGroupPermissions(legacyUser?.permissions ?? buildDefaultPermissions());
  const defaultGroup = normalizeGroup({
    id: randomUUID(),
    name: "Grupo padrão",
    description: "Grupo criado automaticamente no modo local.",
    permissions: legacyPermissions,
  });
  saveStorageArray(USER_GROUPS_KEY, [defaultGroup]);
  return [defaultGroup];
}

function migrateLegacyUsers(users: SystemUser[], groups: UserGroup[]): SystemUser[] {
  const normalizedGroups = ensureDefaultGroup(groups, users);
  const defaultGroupId = normalizedGroups[0]?.id ?? "";
  let changed = false;
  const migrated = users.map((user) => {
    const legacy = user as LegacySystemUser;
    if (legacy.groupId) return user;
    changed = true;
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      groupId: defaultGroupId,
      createdAt: user.createdAt,
    };
  });
  if (changed) {
    saveStorageArray(USERS_KEY, migrated);
  }
  return migrated;
}

/** Retorna todos os grupos cadastrados. */
export function getUserGroups(): UserGroup[] {
  const groups = parseStorageArray<UserGroup>(USER_GROUPS_KEY).map(normalizeGroup);
  const users = parseStorageArray<SystemUser>(USERS_KEY);
  return ensureDefaultGroup(groups, users).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function saveUserGroups(groups: UserGroup[]): void {
  saveStorageArray(USER_GROUPS_KEY, groups);
}

export function getUserGroupById(groupId: string | null | undefined): UserGroup | null {
  if (!groupId) return null;
  return getUserGroups().find((group) => group.id === groupId) ?? null;
}

export function getUserPermissionsByGroupId(groupId: string | null | undefined): UserPermission[] {
  return getRoutePermissions(getUserGroupById(groupId)?.permissions);
}

export function getGroupPermissionsByGroupId(groupId: string | null | undefined): RhGroupPermissions {
  return normalizeGroupPermissions(getUserGroupById(groupId)?.permissions);
}

export function createUserGroup(input: {
  name: string;
  description?: string;
  permissions: RhGroupPermissions | UserPermission[];
}): { ok: boolean; error?: string } {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Nome do grupo é obrigatório." };
  }
  const groups = getUserGroups();
  if (groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "Grupo já existe." };
  }
  const now = new Date().toISOString();
  groups.push({
    id: randomUUID(),
    name,
    description: String(input.description ?? "").trim(),
    permissions: normalizeGroupPermissions(input.permissions),
    createdAt: now,
    updatedAt: now,
  });
  saveUserGroups(groups);
  return { ok: true };
}

export function updateUserGroup(
  id: string,
  updates: { name?: string; description?: string; permissions?: RhGroupPermissions | UserPermission[] },
): { ok: boolean; error?: string } {
  const groups = getUserGroups();
  const idx = groups.findIndex((group) => group.id === id);
  if (idx < 0) return { ok: false, error: "Grupo não encontrado." };

  if (updates.name != null) {
    const name = updates.name.trim();
    if (!name) return { ok: false, error: "Nome do grupo é obrigatório." };
    if (groups.some((group, index) => index !== idx && group.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: "Grupo já existe." };
    }
    groups[idx].name = name;
  }
  if (updates.description != null) {
    groups[idx].description = updates.description.trim();
  }
  if (updates.permissions != null) {
    groups[idx].permissions = normalizeGroupPermissions(updates.permissions);
  }
  groups[idx].updatedAt = new Date().toISOString();
  saveUserGroups(groups);
  return { ok: true };
}

export function deleteUserGroup(id: string): { ok: boolean; error?: string } {
  const users = getSystemUsers();
  if (users.some((user) => user.groupId === id)) {
    return { ok: false, error: "Este grupo está vinculado a um ou mais usuários." };
  }
  const groups = getUserGroups();
  if (groups.length <= 1) {
    return { ok: false, error: "É necessário manter pelo menos um grupo cadastrado." };
  }
  saveUserGroups(groups.filter((group) => group.id !== id));
  return { ok: true };
}

/** Retorna todos os usuários cadastrados. */
export function getSystemUsers(): SystemUser[] {
  const rawUsers = parseStorageArray<SystemUser>(USERS_KEY);
  const groups = parseStorageArray<UserGroup>(USER_GROUPS_KEY).map(normalizeGroup);
  return migrateLegacyUsers(rawUsers, groups);
}

/** Salva os usuários. */
function saveSystemUsers(users: SystemUser[]): void {
  saveStorageArray(USERS_KEY, users);
}

/** Valida credenciais e retorna o usuário ou null. */
export function validateUser(username: string, password: string): SystemUser | null {
  const users = getSystemUsers();
  const hash = simpleHash(password);
  return users.find((u) => u.username === username && u.passwordHash === hash) ?? null;
}

/** Cria um novo usuário. Retorna erro se username já existe. */
export function createUser(
  username: string,
  password: string,
  groupId: string,
): { ok: boolean; error?: string } {
  const users = getSystemUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Usuário já existe." };
  }
  if (!username.trim() || !password.trim()) {
    return { ok: false, error: "Usuário e senha são obrigatórios." };
  }
  if (!groupId.trim() || !getUserGroupById(groupId)) {
    return { ok: false, error: "Grupo de usuário é obrigatório." };
  }
  const user: SystemUser = {
    id: randomUUID(),
    username: username.trim(),
    passwordHash: simpleHash(password),
    groupId: groupId.trim(),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveSystemUsers(users);
  return { ok: true };
}

/** Atualiza um usuário existente. */
export function updateUser(
  id: string,
  updates: { username?: string; password?: string; groupId?: string },
): { ok: boolean; error?: string } {
  const users = getSystemUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return { ok: false, error: "Usuário não encontrado." };

  if (updates.username != null) {
    const un = updates.username.trim();
    if (!un) return { ok: false, error: "Usuário é obrigatório." };
    if (users.some((u, i) => i !== idx && u.username.toLowerCase() === un.toLowerCase())) {
      return { ok: false, error: "Usuário já existe." };
    }
    users[idx].username = un;
  }
  if (updates.password != null && updates.password.trim()) {
    users[idx].passwordHash = simpleHash(updates.password);
  }
  if (updates.groupId != null) {
    if (!updates.groupId.trim() || !getUserGroupById(updates.groupId)) {
      return { ok: false, error: "Grupo de usuário inválido." };
    }
    users[idx].groupId = updates.groupId.trim();
  }
  saveSystemUsers(users);
  return { ok: true };
}

/** Remove um usuário. */
export function deleteUser(id: string): void {
  const users = getSystemUsers().filter((u) => u.id !== id);
  saveSystemUsers(users);
}
