import { randomUUID } from "@rh/lib/utils";
import type { OrganicoArchiveDocument, OrganicoArchiveFolder, OrganicoArchiveFolderScope } from "@rh/lib/organico-documents-api";

export const LAUNCH_DOC_QUEUE_CHANGED_EVENT = "rh-launch-doc-queue-changed";
export const LAUNCH_DOC_TEST_FOLDER_ID = "__launch_doc_test__";
export const LAUNCH_DOC_TEST_FOLDER_NAME = "Lançamentos (teste)";

const INDEX_KEY = "rh_launch_doc_queue_index";
const DB_NAME = "rh-launch-doc-queue";
const DB_VERSION = 1;
const BLOB_STORE = "blobs";

export type LaunchDocumentSource = "ausencia" | "sancao";

export type LaunchDocumentQueueItem = {
  id: string;
  matricula: string;
  colaboradorNome: string;
  category: string;
  classification: string;
  title: string;
  source: LaunchDocumentSource;
  sourceTipo: string;
  sourceTempId: string;
  folderId: string;
  folderScope: "global" | "local";
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  isTest: true;
};

export type EnqueueLaunchDocumentInput = {
  file: File;
  matricula: string;
  colaboradorNome: string;
  category: string;
  classification?: string;
  title: string;
  source: LaunchDocumentSource;
  sourceTipo: string;
  sourceTempId: string;
  folderId: string;
  folderScope: "global" | "local";
};

function notifyQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAUNCH_DOC_QUEUE_CHANGED_EVENT));
}

function readIndex(): LaunchDocumentQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LaunchDocumentQueueItem => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as LaunchDocumentQueueItem).id === "string" &&
        typeof (item as LaunchDocumentQueueItem).matricula === "string"
      );
    }).map((item) => ({
      ...item,
      folderId: String(item.folderId ?? LAUNCH_DOC_TEST_FOLDER_ID).trim() || LAUNCH_DOC_TEST_FOLDER_ID,
      folderScope: item.folderScope === "global" ? "global" : "local",
    }));
  } catch {
    return [];
  }
}

function writeIndex(items: LaunchDocumentQueueItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(items));
  notifyQueueChanged();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste navegador."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao gravar blob."));
    };
    tx.objectStore(BLOB_STORE).put(blob, id);
  });
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao ler blob."));
    };
    const request = tx.objectStore(BLOB_STORE).get(id);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as Blob | undefined) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Falha ao ler blob."));
    };
  });
}

async function deleteBlob(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao excluir blob."));
    };
    tx.objectStore(BLOB_STORE).delete(id);
  });
}

export async function enqueueLaunchDocument(input: EnqueueLaunchDocumentInput): Promise<LaunchDocumentQueueItem> {
  const id = randomUUID();
  const item: LaunchDocumentQueueItem = {
    id,
    matricula: String(input.matricula ?? "").trim(),
    colaboradorNome: String(input.colaboradorNome ?? "").trim(),
    category: String(input.category ?? "").trim(),
    classification: String(input.classification ?? "confidential").trim() || "confidential",
    title: String(input.title ?? "").trim(),
    source: input.source,
    sourceTipo: String(input.sourceTipo ?? "").trim(),
    sourceTempId: String(input.sourceTempId ?? "").trim(),
    folderId: String(input.folderId ?? "").trim(),
    folderScope: input.folderScope === "global" ? "global" : "local",
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSizeBytes: input.file.size,
    createdAt: new Date().toISOString(),
    isTest: true,
  };
  await putBlob(id, input.file);
  const next = [...readIndex(), item];
  writeIndex(next);
  return item;
}

export function listLaunchDocumentsForMatricula(matricula: string): LaunchDocumentQueueItem[] {
  const mat = String(matricula ?? "").trim();
  if (!mat) return [];
  return readIndex().filter((item) => item.matricula === mat);
}

export function listAllLaunchDocuments(): LaunchDocumentQueueItem[] {
  return readIndex();
}

export async function getLaunchDocumentBlob(id: string): Promise<Blob | null> {
  return getBlob(id);
}

export async function clearLaunchDocumentQueue(): Promise<void> {
  const items = readIndex();
  await Promise.all(items.map((item) => deleteBlob(item.id).catch(() => undefined)));
  writeIndex([]);
}

export async function removeLaunchDocumentById(documentId: string): Promise<void> {
  const queueId = launchTestDocumentQueueId(documentId);
  const items = readIndex();
  const next = items.filter((item) => item.id !== queueId);
  writeIndex(next);
  await deleteBlob(queueId).catch(() => undefined);
  revokeLaunchTestDocumentObjectUrl(documentId);
}

export function queueItemToArchiveDocument(item: LaunchDocumentQueueItem): OrganicoArchiveDocument {
  const folderId = item.folderId?.trim() || LAUNCH_DOC_TEST_FOLDER_ID;
  const folderScope: OrganicoArchiveFolderScope =
    item.folderScope === "global" || item.folderScope === "local" ? item.folderScope : "local";
  return {
    id: `test-${item.id}`,
    title: item.title,
    fileName: item.fileName,
    category: item.category,
    classification: item.classification,
    mimeType: item.mimeType,
    fileSizeBytes: item.fileSizeBytes,
    coverUrl: null,
    downloadUrl: null,
    sourcePages: null,
    source: "individual",
    folderScope,
    folderId,
    createdAt: item.createdAt,
  };
}

function insertTestDocumentIntoFolderTree(
  folders: OrganicoArchiveFolder[],
  folderId: string,
  folderScope: OrganicoArchiveFolderScope,
  document: OrganicoArchiveDocument,
): OrganicoArchiveFolder[] {
  let inserted = false;
  const next = folders.map((folder) => {
    if (folder.id === folderId && folder.scope === folderScope) {
      inserted = true;
      if (folder.documents.some((d) => d.id === document.id)) return folder;
      return { ...folder, documents: [...folder.documents, document] };
    }
    if (folder.children.length === 0) return folder;
    const children = insertTestDocumentIntoFolderTree(folder.children, folderId, folderScope, document);
    if (children !== folder.children) inserted = true;
    return { ...folder, children };
  });
  return inserted ? next : folders;
}

function ensureTestFolder(folders: OrganicoArchiveFolder[]): OrganicoArchiveFolder[] {
  if (folders.some((f) => f.id === LAUNCH_DOC_TEST_FOLDER_ID)) return folders;
  return [
    {
      id: LAUNCH_DOC_TEST_FOLDER_ID,
      name: LAUNCH_DOC_TEST_FOLDER_NAME,
      scope: "local",
      children: [],
      documents: [],
    },
    ...folders,
  ];
}

export function mergeLaunchDocumentsIntoFolders(
  folders: OrganicoArchiveFolder[],
  matricula: string,
): OrganicoArchiveFolder[] {
  const items = listLaunchDocumentsForMatricula(matricula);
  if (items.length === 0) return folders;

  let tree = ensureTestFolder(folders);
  for (const item of items) {
    const document = queueItemToArchiveDocument(item);
    const targetId = document.folderId || LAUNCH_DOC_TEST_FOLDER_ID;
    const targetScope = document.folderScope;
    const updated = insertTestDocumentIntoFolderTree(tree, targetId, targetScope, document);
    if (updated === tree && targetId === LAUNCH_DOC_TEST_FOLDER_ID) {
      tree = tree.map((f) =>
        f.id === LAUNCH_DOC_TEST_FOLDER_ID
          ? f.documents.some((d) => d.id === document.id)
            ? f
            : { ...f, documents: [...f.documents, document] }
          : f,
      );
    } else {
      tree = updated;
    }
  }
  return tree;
}

export function isLaunchTestDocumentId(documentId: string): boolean {
  return String(documentId).startsWith("test-");
}

export function launchTestDocumentQueueId(documentId: string): string {
  return String(documentId).replace(/^test-/, "");
}

const blobUrlCache = new Map<string, string>();

export async function getLaunchTestDocumentObjectUrl(documentId: string): Promise<string | null> {
  const queueId = launchTestDocumentQueueId(documentId);
  const cached = blobUrlCache.get(queueId);
  if (cached) return cached;
  const blob = await getLaunchDocumentBlob(queueId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(queueId, url);
  return url;
}

export function revokeLaunchTestDocumentObjectUrl(documentId: string): void {
  const queueId = launchTestDocumentQueueId(documentId);
  const cached = blobUrlCache.get(queueId);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(queueId);
  }
}
