import { getRequiredRhSessionToken, isApiConfigured } from "@rh/lib/api-client";

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "";

const ANON_KEY =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY
    ? String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim()
    : "";

/** Mesmo padrão de `api-client.ts`: Authorization (não `apikey`) — CORS das Edge Functions só permite Authorization. */
function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extra ?? {}),
  };
  if (ANON_KEY) headers.Authorization = `Bearer ${ANON_KEY}`;
  return headers;
}

async function parseError(res: Response, path: string): Promise<never> {
  let msg = `API ${path}: ${res.status}`;
  try {
    const json = (await res.json()) as { error?: string };
    if (typeof json?.error === "string" && json.error.trim()) msg = json.error;
  } catch {
    /* ignorar */
  }
  throw new Error(msg);
}

async function secureGet<T>(path: string): Promise<T> {
  if (!API_BASE) throw new Error("API não configurada");
  const token = getRequiredRhSessionToken();
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    method: "GET",
    headers: apiHeaders({ "X-RH-Session": token }),
    credentials: "same-origin",
  });
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

async function securePost<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE) throw new Error("API não configurada");
  const token = getRequiredRhSessionToken();
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json", "X-RH-Session": token }),
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

async function secureFormPost<T>(path: string, body: FormData): Promise<T> {
  if (!API_BASE) throw new Error("API não configurada");
  const token = getRequiredRhSessionToken();
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: apiHeaders({ "X-RH-Session": token }),
    body,
    credentials: "same-origin",
  });
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

export type OrganicoArchiveFolderScope = "global" | "local";

export type OrganicoArchiveDocument = {
  id: string;
  title: string;
  fileName: string;
  category: string;
  classification: string;
  mimeType: string;
  fileSizeBytes: number;
  coverUrl: string | null;
  downloadUrl: string | null;
  sourcePages: string | null;
  source: "individual" | "bulk";
  folderScope: OrganicoArchiveFolderScope;
  folderId: string;
  createdAt: string;
};

export type OrganicoArchiveFolder = {
  id: string;
  name: string;
  scope: OrganicoArchiveFolderScope;
  children: OrganicoArchiveFolder[];
  documents: OrganicoArchiveDocument[];
};

export type OrganicoArchiveFolderRef = {
  id: string;
  scope: OrganicoArchiveFolderScope;
};

export function findArchiveFolder(
  folders: OrganicoArchiveFolder[],
  folderId: string | null,
  scope?: OrganicoArchiveFolderScope,
): OrganicoArchiveFolder | null {
  if (!folderId) return null;
  for (const folder of folders) {
    if (folder.id === folderId && (scope == null || folder.scope === scope)) return folder;
    const child = findArchiveFolder(folder.children, folderId, scope);
    if (child) return child;
  }
  return null;
}

export function findArchiveFolderPath(
  folders: OrganicoArchiveFolder[],
  folderId: string | null,
): OrganicoArchiveFolder[] {
  if (!folderId) return [];
  for (const folder of folders) {
    if (folder.id === folderId) return [folder];
    const childPath = findArchiveFolderPath(folder.children, folderId);
    if (childPath.length > 0) return [folder, ...childPath];
  }
  return [];
}

export function findArchiveParentFolderId(
  folders: OrganicoArchiveFolder[],
  folderId: string | null,
  parentId: string | null = null,
): string | null {
  if (!folderId) return null;
  for (const folder of folders) {
    if (folder.id === folderId) return parentId;
    const found = findArchiveParentFolderId(folder.children, folderId, folder.id);
    if (found !== null) return found;
  }
  return null;
}

export type ArchiveFolderOption = {
  id: string;
  scope: OrganicoArchiveFolderScope;
  label: string;
};

/** Lista pastas do card (inclui subpastas) para seleção no lançamento. */
export function flattenArchiveFolderOptions(folders: OrganicoArchiveFolder[]): ArchiveFolderOption[] {
  const out: ArchiveFolderOption[] = [];

  const walk = (nodes: OrganicoArchiveFolder[], prefix: string) => {
    for (const folder of nodes) {
      const scopeLabel = folder.scope === "global" ? "Global" : "Individual";
      const label = prefix ? `${prefix} / ${folder.name}` : `${scopeLabel} · ${folder.name}`;
      out.push({ id: folder.id, scope: folder.scope, label });
      if (folder.children.length > 0) walk(folder.children, label);
    }
  };

  walk(folders, "");
  return out;
}

export function archiveFolderOptionKey(option: Pick<ArchiveFolderOption, "id" | "scope">): string {
  return `${option.scope}:${option.id}`;
}

export function parseArchiveFolderOptionKey(key: string): { id: string; scope: OrganicoArchiveFolderScope } | null {
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  const scope = key.slice(0, sep);
  const id = key.slice(sep + 1).trim();
  if (!id) return null;
  if (scope !== "global" && scope !== "local") return null;
  return { id, scope };
}

export async function getOrganicoDocuments(matricula: string, colaboradorNome: string): Promise<OrganicoArchiveFolder[]> {
  if (!isApiConfigured()) return [];
  const params = new URLSearchParams({ matricula, nome: colaboradorNome });
  const raw = await secureGet<{ folders?: OrganicoArchiveFolder[] }>(`get-organico-documents?${params.toString()}`);
  return Array.isArray(raw.folders) ? raw.folders : [];
}

export async function createOrganicoArchiveFolder(input: {
  matricula: string;
  colaboradorNome: string;
  name: string;
  scope: OrganicoArchiveFolderScope;
  parentId: string | null;
  parentScope: OrganicoArchiveFolderScope | null;
}): Promise<{ id: string; scope: OrganicoArchiveFolderScope }> {
  return securePost("create-organico-archive-folder", input);
}

export async function hideOrganicoArchiveFolder(input: {
  matricula: string;
  folderId: string;
  scope: OrganicoArchiveFolderScope;
  globalMode?: "delete_one" | "delete_all";
  confirm: true;
}): Promise<{ ok: boolean }> {
  return securePost("hide-organico-archive-folder", input);
}

export async function renameOrganicoArchiveFolder(input: {
  matricula: string;
  colaboradorNome: string;
  folderId: string;
  scope: OrganicoArchiveFolderScope;
  name: string;
}): Promise<{ ok: boolean }> {
  return securePost("rename-organico-archive-folder", input);
}

export async function uploadOrganicoDocument(input: {
  matricula: string;
  colaboradorNome: string;
  title: string;
  category: string;
  classification: string;
  folderScope: OrganicoArchiveFolderScope;
  folderId: string;
  file: File;
  cover?: File | null;
  sourceKind?: "individual" | "bulk";
  sourcePages?: string | null;
  launchSource?: string;
  launchSourceRecordId?: string;
}): Promise<{ ok: boolean; id: string }> {
  const form = new FormData();
  form.set("matricula", input.matricula);
  form.set("colaboradorNome", input.colaboradorNome);
  form.set("title", input.title);
  form.set("category", input.category);
  form.set("classification", input.classification);
  form.set("folderScope", input.folderScope);
  form.set("folderId", input.folderId);
  form.set("sourceKind", input.sourceKind ?? "individual");
  if (input.sourcePages) form.set("sourcePages", input.sourcePages);
  if (input.launchSource) form.set("launchSource", input.launchSource);
  if (input.launchSourceRecordId) form.set("launchSourceRecordId", input.launchSourceRecordId);
  form.set("file", input.file);
  if (input.cover) form.set("cover", input.cover);
  return secureFormPost("upload-organico-document", form);
}

export async function deleteOrganicoDocument(input: {
  matricula: string;
  documentId: string;
  confirm: true;
}): Promise<{ ok: boolean }> {
  return securePost("delete-organico-document", input);
}

export async function fetchOrganicoDocumentUrl(input: {
  matricula: string;
  documentId: string;
  kind?: "file" | "cover";
}): Promise<string> {
  const params = new URLSearchParams({
    matricula: input.matricula,
    documentId: input.documentId,
    kind: input.kind ?? "file",
  });
  const raw = await secureGet<{ url?: string }>(`download-organico-document?${params.toString()}`);
  if (!raw.url) throw new Error("URL indisponível.");
  return raw.url;
}

export type ResolveLaunchDocumentItem = {
  source: "ausencia" | "sancao";
  sourceRecordId: string;
  matricula: string;
  data?: string;
  tipo?: string;
  colaboradorNome?: string;
  expectedTitle?: string;
};

export type ResolvedLaunchDocumentLink = {
  sourceRecordId: string;
  documentId: string;
  matricula: string;
  title: string;
  fileName: string;
  mimeType: string;
};

export async function resolveLaunchDocuments(input: {
  items: ResolveLaunchDocumentItem[];
}): Promise<{ links: ResolvedLaunchDocumentLink[] }> {
  return securePost("resolve-launch-documents", input);
}

export { isApiConfigured as isOrganicoDocumentsApiConfigured };
