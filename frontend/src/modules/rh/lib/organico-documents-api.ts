import { isApiConfigured } from "@rh/lib/api-client";
import { resolveUploadUrl } from "@/api/client";
import { parseRhApiError, rhFetch, rhFetchJson } from "@rh/lib/rh-fetch";

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
  const raw = await rhFetchJson<{ folders?: OrganicoArchiveFolder[] }>(
    `get-organico-documents?${params.toString()}`,
  );
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
  return rhFetchJson("create-organico-archive-folder", { method: "POST", body: input });
}

export async function hideOrganicoArchiveFolder(input: {
  matricula: string;
  folderId: string;
  scope: OrganicoArchiveFolderScope;
  globalMode?: "delete_one" | "delete_all";
  confirm: true;
}): Promise<{ ok: boolean }> {
  return rhFetchJson("hide-organico-archive-folder", { method: "POST", body: input });
}

export async function renameOrganicoArchiveFolder(input: {
  matricula: string;
  colaboradorNome: string;
  folderId: string;
  scope: OrganicoArchiveFolderScope;
  name: string;
}): Promise<{ ok: boolean }> {
  return rhFetchJson("rename-organico-archive-folder", { method: "POST", body: input });
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

  const res = await rhFetch("upload-organico-document", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(await parseRhApiError(res, "upload-organico-document"));
  }
  return res.json() as Promise<{ ok: boolean; id: string }>;
}

export async function deleteOrganicoDocument(input: {
  matricula: string;
  documentId: string;
  confirm: true;
}): Promise<{ ok: boolean }> {
  return rhFetchJson("delete-organico-document", { method: "POST", body: input });
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
  const raw = await rhFetchJson<{ url?: string }>(
    `download-organico-document?${params.toString()}`,
  );
  if (!raw.url) throw new Error("URL indisponível.");
  return resolveUploadUrl(raw.url);
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
  return rhFetchJson("resolve-launch-documents", { method: "POST", body: input });
}

export { isApiConfigured as isOrganicoDocumentsApiConfigured };
