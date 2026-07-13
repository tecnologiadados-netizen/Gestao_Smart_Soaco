import { prisma } from '../../config/prisma.js';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  deleteRhFileIfExists,
  MAX_DOCUMENT_SIZE_BYTES,
  newDocumentId,
  readRhFileAsBuffer,
  rhCoverStoragePath,
  rhStoragePath,
  saveRhFile,
  sanitizeStorageSegment,
  sha256Hex,
} from '../utils/rhUpload.js';
import { s } from '../utils/rhHelpers.js';

export type ArchiveFolderScope = 'global' | 'local';

export type ArchiveDocumentDto = {
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
  source: 'individual' | 'bulk';
  folderScope: ArchiveFolderScope;
  folderId: string;
  createdAt: string;
};

export type ArchiveFolderDto = {
  id: string;
  name: string;
  scope: ArchiveFolderScope;
  children: ArchiveFolderDto[];
  documents: ArchiveDocumentDto[];
};

function collectDescendantIds(
  parentId: string,
  byParent: Map<string | null, Array<{ id: string }>>,
): Set<string> {
  const hidden = new Set<string>();
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    hidden.add(current);
    for (const child of byParent.get(current) ?? []) stack.push(child.id);
  }
  return hidden;
}

function buildGlobalSubtree(
  parentId: string | null,
  byParent: Map<string | null, Array<{ id: string; name: string; sortOrder: number }>>,
  excluded: Set<string>,
): ArchiveFolderDto[] {
  return (byParent.get(parentId) ?? [])
    .filter((row) => !excluded.has(row.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
    .map((row) => ({
      id: row.id,
      name: row.name,
      scope: 'global' as const,
      children: buildGlobalSubtree(row.id, byParent, excluded),
      documents: [],
    }));
}

function insertLocalFolders(
  nodes: ArchiveFolderDto[],
  localRows: Array<{
    id: string;
    parentGlobalId: string | null;
    parentLocalId: string | null;
    name: string;
    sortOrder: number;
  }>,
  parentGlobalId: string | null,
  parentLocalId: string | null,
): ArchiveFolderDto[] {
  const next = [...nodes];
  const children = localRows
    .filter((row) =>
      parentGlobalId
        ? row.parentGlobalId === parentGlobalId && !row.parentLocalId
        : parentLocalId
          ? row.parentLocalId === parentLocalId
          : !row.parentGlobalId && !row.parentLocalId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'));

  for (const row of children) {
    next.push({
      id: row.id,
      name: row.name,
      scope: 'local',
      children: insertLocalFolders([], localRows, null, row.id),
      documents: [],
    });
  }
  return next;
}

function attachLocalToTree(
  nodes: ArchiveFolderDto[],
  localRows: Array<{
    id: string;
    parentGlobalId: string | null;
    parentLocalId: string | null;
    name: string;
    sortOrder: number;
  }>,
): ArchiveFolderDto[] {
  return nodes.map((node) => {
    const localChildren = localRows
      .filter((row) => row.parentGlobalId === node.id && !row.parentLocalId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
      .map((row) => ({
        id: row.id,
        name: row.name,
        scope: 'local' as const,
        children: insertLocalFolders([], localRows, null, row.id),
        documents: [],
      }));
    return {
      ...node,
      children: attachLocalToTree(node.children, localRows).concat(localChildren),
    };
  });
}

function mapDocument(
  doc: {
    id: string;
    title: string;
    originalName: string;
    category: string;
    classification: string;
    mimeType: string;
    sizeBytes: number;
    coverStoragePath: string | null;
    storagePath: string;
    sourcePages: string | null;
    sourceKind: string;
    createdAt: Date | null;
    globalFolderId: string | null;
    localFolderId: string | null;
  },
  folderScope: ArchiveFolderScope,
  folderId: string,
): ArchiveDocumentDto {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.originalName,
    category: doc.category,
    classification: doc.classification,
    mimeType: doc.mimeType,
    fileSizeBytes: doc.sizeBytes,
    coverUrl: doc.coverStoragePath,
    downloadUrl: doc.storagePath,
    sourcePages: doc.sourcePages,
    source: doc.sourceKind === 'bulk' ? 'bulk' : 'individual',
    folderScope,
    folderId,
    createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function attachDocuments(
  nodes: ArchiveFolderDto[],
  docs: Array<{
    id: string;
    title: string;
    originalName: string;
    category: string;
    classification: string;
    mimeType: string;
    sizeBytes: number;
    coverStoragePath: string | null;
    storagePath: string;
    sourcePages: string | null;
    sourceKind: string;
    createdAt: Date | null;
    globalFolderId: string | null;
    localFolderId: string | null;
  }>,
): ArchiveFolderDto[] {
  return nodes.map((node) => {
    const folderDocs = docs
      .filter((doc) =>
        node.scope === 'global' ? doc.globalFolderId === node.id : doc.localFolderId === node.id,
      )
      .map((doc) => mapDocument(doc, node.scope, node.id));
    return {
      ...node,
      children: attachDocuments(node.children, docs),
      documents: folderDocs,
    };
  });
}

export async function buildArchiveTreeForMatricula(matricula: string): Promise<ArchiveFolderDto[]> {
  const [globalRows, hiddenRows, localRows, docs] = await Promise.all([
    prisma.rhOrganicoArchiveFolderGlobal.findMany({
      select: { id: true, parentId: true, name: true, sortOrder: true },
    }),
    prisma.rhOrganicoArchiveFolderHidden.findMany({
      where: { matricula },
      select: { globalFolderId: true },
    }),
    prisma.rhOrganicoArchiveFolderLocal.findMany({ where: { matricula } }),
    prisma.rhOrganicoDocuments.findMany({
      where: { matricula, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const byParent = new Map<string | null, Array<{ id: string; name: string; sortOrder: number }>>();
  for (const row of globalRows) {
    const key = row.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }

  const excluded = new Set<string>();
  for (const hidden of hiddenRows) {
    for (const id of collectDescendantIds(hidden.globalFolderId, byParent)) excluded.add(id);
  }

  let tree = buildGlobalSubtree(null, byParent, excluded);
  tree = insertLocalFolders(tree, localRows, null, null);
  tree = attachLocalToTree(tree, localRows);
  return attachDocuments(tree, docs);
}

export async function writeDocumentAudit(input: {
  documentId?: string | null;
  matricula: string;
  action: string;
  actor: string;
  details?: Record<string, unknown>;
}) {
  await prisma.rhOrganicoDocumentAudit.create({
    data: {
      documentId: input.documentId ?? null,
      matricula: input.matricula,
      action: input.action,
      actor: input.actor,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
    },
  });
}

export async function uploadOrganicoDocument(input: {
  matricula: string;
  title: string;
  category: string;
  classification: string;
  folderScope: 'global' | 'local';
  folderId: string;
  sourceKind: 'individual' | 'bulk';
  sourcePages?: string | null;
  launchSource?: string | null;
  launchSourceRecordId?: string | null;
  createdBy: string;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  cover?: { buffer: Buffer; mimetype: string } | null;
}) {
  if (input.file.size <= 0 || input.file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error('Arquivo excede o limite de 20 MB.');
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(input.file.mimetype)) {
    throw new Error('Formato não permitido.');
  }

  const documentId = newDocumentId();
  const hash = sha256Hex(input.file.buffer);
  const storagePath = rhStoragePath(input.matricula, documentId, input.file.originalname);
  saveRhFile(storagePath, input.file.buffer);

  let coverStoragePath: string | null = null;
  if (input.cover?.buffer?.length) {
    coverStoragePath = rhCoverStoragePath(documentId);
    saveRhFile(coverStoragePath, input.cover.buffer);
  }

  const row = await prisma.rhOrganicoDocuments.create({
    data: {
      id: documentId,
      matricula: input.matricula,
      globalFolderId: input.folderScope === 'global' ? input.folderId : null,
      localFolderId: input.folderScope === 'local' ? input.folderId : null,
      title: input.title,
      category: input.category,
      classification: input.classification,
      originalName: sanitizeStorageSegment(input.file.originalname),
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      sha256: hash,
      storagePath,
      coverStoragePath,
      sourcePages: input.sourcePages ?? null,
      sourceKind: input.sourceKind,
      launchSource: input.launchSource ?? null,
      launchSourceRecordId: input.launchSourceRecordId ?? null,
      createdBy: input.createdBy,
      status: 'active',
    },
  });

  await writeDocumentAudit({
    documentId: row.id,
    matricula: input.matricula,
    action: 'upload',
    actor: input.createdBy,
    details: { title: input.title, category: input.category },
  });

  return {
    id: row.id,
    storagePath: row.storagePath,
    coverStoragePath: row.coverStoragePath,
  };
}

export async function downloadOrganicoDocument(documentId: string) {
  const row = await prisma.rhOrganicoDocuments.findFirst({
    where: { id: documentId, status: 'active' },
  });
  if (!row) return null;
  const buffer = readRhFileAsBuffer(row.storagePath);
  if (!buffer) return null;
  return { row, buffer };
}

export async function deleteOrganicoDocument(documentId: string, actor: string) {
  const row = await prisma.rhOrganicoDocuments.findUnique({ where: { id: documentId } });
  if (!row) throw new Error('Documento não encontrado.');

  await prisma.rhOrganicoDocuments.update({
    where: { id: documentId },
    data: { status: 'deleted', deletedAt: new Date(), deletedBy: actor },
  });
  deleteRhFileIfExists(row.storagePath);
  deleteRhFileIfExists(row.coverStoragePath);

  await writeDocumentAudit({
    documentId,
    matricula: row.matricula,
    action: 'delete',
    actor,
    details: { title: row.title },
  });
}

export async function getOrganicoDocuments(matricula: string) {
  return buildArchiveTreeForMatricula(matricula);
}
