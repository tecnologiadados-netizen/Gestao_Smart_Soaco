import type { LaunchDocumentSource } from "@rh/lib/launch-document-queue";

export const LAUNCH_DOC_LINKS_CHANGED_EVENT = "rh-launch-doc-links-changed";

const STORAGE_KEY = "rh_launch_doc_links_v1";

export type LaunchDocumentLink = {
  source: LaunchDocumentSource;
  sourceTempId: string;
  documentId: string;
  matricula: string;
  fileName: string;
  title: string;
  mimeType?: string;
  createdAt: string;
};

export type SaveLaunchDocumentLinkInput = Omit<LaunchDocumentLink, "createdAt">;

function notifyLinksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAUNCH_DOC_LINKS_CHANGED_EVENT));
}

function readLinks(): LaunchDocumentLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LaunchDocumentLink => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as LaunchDocumentLink).sourceTempId === "string" &&
        typeof (item as LaunchDocumentLink).documentId === "string" &&
        typeof (item as LaunchDocumentLink).matricula === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeLinks(items: LaunchDocumentLink[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifyLinksChanged();
}

export function listLaunchDocumentLinks(): LaunchDocumentLink[] {
  return readLinks();
}

export function saveLaunchDocumentLink(input: SaveLaunchDocumentLinkInput): LaunchDocumentLink {
  const link: LaunchDocumentLink = {
    source: input.source,
    sourceTempId: String(input.sourceTempId ?? "").trim(),
    documentId: String(input.documentId ?? "").trim(),
    matricula: String(input.matricula ?? "").trim(),
    fileName: String(input.fileName ?? "").trim() || "documento",
    title: String(input.title ?? "").trim() || "Documento",
    mimeType: input.mimeType?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const items = readLinks().filter(
    (item) => !(item.source === link.source && item.sourceTempId === link.sourceTempId),
  );
  writeLinks([...items, link]);
  return link;
}
