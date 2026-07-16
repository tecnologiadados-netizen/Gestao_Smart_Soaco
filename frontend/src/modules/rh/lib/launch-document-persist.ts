import { isLaunchDocAttachmentEnabled, isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import { saveLaunchDocumentLink } from "@rh/lib/launch-document-links";
import { validateOrganicoDocumentFile } from "@rh/lib/organico-document-contract";
import { uploadOrganicoDocument } from "@rh/lib/organico-documents-api";
import { enqueueLaunchDocument, type LaunchDocumentSource } from "@rh/lib/launch-document-queue";

export type PersistLaunchDocumentInput = {
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

export async function persistLaunchDocumentAttachment(input: PersistLaunchDocumentInput): Promise<void> {
  if (!isLaunchDocAttachmentEnabled()) return;

  const validation = validateOrganicoDocumentFile(input.file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  if (isLaunchDocTestMode()) {
    await enqueueLaunchDocument({
      file: input.file,
      matricula: input.matricula,
      colaboradorNome: input.colaboradorNome,
      category: input.category,
      classification: input.classification ?? "confidential",
      title: input.title,
      source: input.source,
      sourceTipo: input.sourceTipo,
      sourceTempId: input.sourceTempId,
      folderId: input.folderId,
      folderScope: input.folderScope,
    });
    return;
  }

  const result =   await uploadOrganicoDocument({
    matricula: input.matricula,
    colaboradorNome: input.colaboradorNome,
    title: input.title,
    category: input.category,
    classification: input.classification ?? "confidential",
    folderScope: input.folderScope,
    folderId: input.folderId,
    file: input.file,
    sourceKind: "individual",
    launchSource: input.source,
    launchSourceRecordId: input.sourceTempId,
  });

  saveLaunchDocumentLink({
    source: input.source,
    sourceTempId: input.sourceTempId,
    documentId: result.id,
    matricula: input.matricula,
    fileName: input.file.name,
    title: input.title,
    mimeType: input.file.type,
  });
}

export { isLaunchDocAttachmentEnabled, isLaunchDocTestMode };
