import {
  getLaunchTestDocumentObjectUrl,
  isLaunchTestDocumentId,
  listAllLaunchDocuments,
  type LaunchDocumentSource,
} from "@rh/lib/launch-document-queue";
import { listLaunchDocumentLinks } from "@rh/lib/launch-document-links";
import {
  fetchOrganicoDocumentUrl,
  type ResolvedLaunchDocumentLink,
  type ResolveLaunchDocumentItem,
} from "@rh/lib/organico-documents-api";
import {
  ausenciaSuportaAnexoDocumento,
  buildLaunchDocumentTitle,
  resolveLaunchDocumentCategory,
} from "@rh/lib/launch-document-rules";
import type { FaltaRow, SancaoDisciplinarRow } from "@rh/types/api";

export type AusenciaLaunchAttachment = {
  documentId: string;
  matricula: string;
  fileName: string;
  title: string;
  mimeType?: string;
  isTest: boolean;
};

function queueItemToAttachment(sourceTempId: string): AusenciaLaunchAttachment | null {
  const item = listAllLaunchDocuments().find(
    (entry) => entry.source === "ausencia" && entry.sourceTempId === sourceTempId,
  );
  if (!item) return null;
  return {
    documentId: `test-${item.id}`,
    matricula: item.matricula,
    fileName: item.fileName,
    title: item.title,
    mimeType: item.mimeType,
    isTest: true,
  };
}

function linkToAttachment(source: LaunchDocumentSource, sourceTempId: string): AusenciaLaunchAttachment | null {
  const link = listLaunchDocumentLinks().find(
    (entry) => entry.source === source && entry.sourceTempId === sourceTempId,
  );
  if (!link) return null;
  return {
    documentId: link.documentId,
    matricula: link.matricula,
    fileName: link.fileName,
    title: link.title,
    mimeType: link.mimeType,
    isTest: false,
  };
}

export function findAusenciaLaunchAttachment(sourceTempId: string): AusenciaLaunchAttachment | null {
  const id = String(sourceTempId ?? "").trim();
  if (!id) return null;
  return queueItemToAttachment(id) ?? linkToAttachment("ausencia", id);
}

function buildLaunchAttachmentIndex(source: LaunchDocumentSource): Map<string, AusenciaLaunchAttachment> {
  const map = new Map<string, AusenciaLaunchAttachment>();
  const usedDocumentIds = new Set<string>();

  for (const item of listAllLaunchDocuments()) {
    if (item.source !== source || !item.sourceTempId.trim()) continue;
    const documentId = `test-${item.id}`;
    if (usedDocumentIds.has(documentId)) continue;
    map.set(item.sourceTempId, {
      documentId,
      matricula: item.matricula,
      fileName: item.fileName,
      title: item.title,
      mimeType: item.mimeType,
      isTest: true,
    });
    usedDocumentIds.add(documentId);
  }

  for (const link of listLaunchDocumentLinks()) {
    if (link.source !== source || !link.sourceTempId.trim()) continue;
    if (map.has(link.sourceTempId) || usedDocumentIds.has(link.documentId)) continue;
    map.set(link.sourceTempId, {
      documentId: link.documentId,
      matricula: link.matricula,
      fileName: link.fileName,
      title: link.title,
      mimeType: link.mimeType,
      isTest: false,
    });
    usedDocumentIds.add(link.documentId);
  }

  return map;
}

export function buildAusenciaAttachmentIndex(): Map<string, AusenciaLaunchAttachment> {
  return buildLaunchAttachmentIndex("ausencia");
}

export function buildSancaoAttachmentIndex(): Map<string, AusenciaLaunchAttachment> {
  return buildLaunchAttachmentIndex("sancao");
}

export function buildAusenciaAttachmentResolveItems(
  rows: FaltaRow[],
  categoryOptions: string[],
): ResolveLaunchDocumentItem[] {
  const items: ResolveLaunchDocumentItem[] = [];
  for (const row of rows) {
    const tipo = String(row.tipo ?? "").trim();
    if (!ausenciaSuportaAnexoDocumento(tipo)) continue;
    const sourceRecordId = String(row.id ?? "").trim();
    const matricula = String(row.matricula ?? "").trim();
    if (!sourceRecordId || !matricula) continue;
    const category = resolveLaunchDocumentCategory({
      source: "ausencia",
      tipo,
      categoryOptions,
    });
    items.push({
      source: "ausencia",
      sourceRecordId,
      matricula,
      data: String(row.data ?? "").trim().slice(0, 10),
      tipo,
      colaboradorNome: String(row.nomeFuncionario ?? "").trim(),
      expectedTitle: buildLaunchDocumentTitle({
        category,
        dataIso: String(row.data ?? ""),
        colaboradorNome: String(row.nomeFuncionario ?? ""),
      }),
    });
  }
  return items;
}

export function buildSancaoAttachmentResolveItems(
  rows: SancaoDisciplinarRow[],
  categoryOptions: string[],
): ResolveLaunchDocumentItem[] {
  const items: ResolveLaunchDocumentItem[] = [];
  for (const row of rows) {
    const sourceRecordId = String(row.id ?? "").trim();
    const matricula = String(row.matricula ?? "").trim();
    if (!sourceRecordId || !matricula) continue;
    // Linhas provisórias ainda não têm id do banco — nada a resolver no servidor.
    if (sourceRecordId.startsWith("temp-") || sourceRecordId.startsWith("import-")) continue;
    const tipo = String(row.tipo ?? "").trim();
    const category = resolveLaunchDocumentCategory({
      source: "sancao",
      tipo,
      categoryOptions,
    });
    items.push({
      source: "sancao",
      sourceRecordId,
      matricula,
      data: String(row.dataAplicacao ?? "").trim().slice(0, 10),
      tipo,
      colaboradorNome: String(row.nomeFuncionario ?? "").trim(),
      expectedTitle: buildLaunchDocumentTitle({
        category,
        dataIso: String(row.dataAplicacao ?? ""),
        colaboradorNome: String(row.nomeFuncionario ?? ""),
      }),
    });
  }
  return items;
}

export function mergeAusenciaAttachmentIndex(
  localIndex: Map<string, AusenciaLaunchAttachment>,
  serverLinks: ResolvedLaunchDocumentLink[],
): Map<string, AusenciaLaunchAttachment> {
  const merged = new Map(localIndex);
  const usedDocumentIds = new Set<string>();
  for (const attachment of merged.values()) {
    usedDocumentIds.add(attachment.documentId);
  }

  for (const link of serverLinks) {
    const key = String(link.sourceRecordId ?? "").trim();
    if (!key || merged.has(key)) continue;
    if (usedDocumentIds.has(link.documentId)) continue;
    merged.set(key, {
      documentId: link.documentId,
      matricula: link.matricula,
      fileName: link.fileName,
      title: link.title,
      mimeType: link.mimeType,
      isTest: false,
    });
    usedDocumentIds.add(link.documentId);
  }
  return merged;
}

async function resolveAttachmentUrl(attachment: AusenciaLaunchAttachment): Promise<string> {
  if (attachment.isTest || isLaunchTestDocumentId(attachment.documentId)) {
    const url = await getLaunchTestDocumentObjectUrl(attachment.documentId);
    if (!url) throw new Error("Documento de teste indisponível.");
    return url;
  }

  return fetchOrganicoDocumentUrl({
    matricula: attachment.matricula,
    documentId: attachment.documentId,
  });
}

/** Abre o anexo em nova aba — mesmo fluxo do arquivamento do Orgânico. */
export async function openAusenciaLaunchAttachment(attachment: AusenciaLaunchAttachment): Promise<void> {
  const url = await resolveAttachmentUrl(attachment);
  window.open(url, "_blank", "noopener");
}
