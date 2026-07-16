import {
  ORGANICO_DOCUMENT_SECURITY_POLICY,
  type OrganicoDocumentCategoryId,
  type OrganicoDocumentClassificationId,
} from "@rh/lib/organico-documents";

export type OrganicoDocumentStatus = "active" | "replaced" | "deleted";
export type OrganicoDocumentAuditAction = "upload" | "view" | "download" | "replace" | "delete" | "restore";
export type OrganicoDocumentRetentionPolicy = "retain_with_audit" | "soft_delete" | "hard_delete_after_review";

export type OrganicoDocumentMetadata = {
  id: string;
  colaboradorMatricula: string;
  colaboradorNome: string;
  category: OrganicoDocumentCategoryId;
  classification: OrganicoDocumentClassificationId;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  status: OrganicoDocumentStatus;
  retentionPolicy: OrganicoDocumentRetentionPolicy;
  createdBy: string;
  createdAt: string;
  replacedByDocumentId?: string | null;
  deletedAt?: string | null;
};

export type OrganicoDocumentAuditEvent = {
  id: string;
  documentId: string;
  action: OrganicoDocumentAuditAction;
  actor: string;
  occurredAt: string;
  colaboradorMatricula: string;
  reason?: string | null;
};

export type OrganicoDocumentUploadRequest = {
  colaboradorMatricula: string;
  colaboradorNome: string;
  category: OrganicoDocumentCategoryId;
  classification: OrganicoDocumentClassificationId;
  file: File;
};

export function validateOrganicoDocumentFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!file) {
    return { ok: false, error: "Selecione um arquivo para anexar." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "O arquivo selecionado está vazio." };
  }
  const maxBytes = ORGANICO_DOCUMENT_SECURITY_POLICY.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `O arquivo excede o limite de ${ORGANICO_DOCUMENT_SECURITY_POLICY.maxFileSizeMb} MB.`,
    };
  }
  if (!(ORGANICO_DOCUMENT_SECURITY_POLICY.allowedMimeTypes as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Formato não permitido para documentos de colaboradores." };
  }
  return { ok: true };
}
