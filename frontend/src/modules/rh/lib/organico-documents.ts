export const ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS = [
  {
    id: "internal",
    label: "Interno",
    description: "Documento administrativo sem dado sensível além do contexto do colaborador.",
  },
  {
    id: "confidential",
    label: "Confidencial",
    description: "Documento com dados pessoais ou conteúdo restrito ao RH.",
  },
  {
    id: "highly_confidential",
    label: "Altamente confidencial",
    description: "Documento sensível que exige acesso excepcional e auditoria reforçada.",
  },
] as const;

export type OrganicoDocumentClassificationId = (typeof ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS)[number]["id"];

export const DEFAULT_DOCUMENT_CATEGORY_LABELS = [
  "Admissão",
  "Atestado",
  "Justificativa pontual de falta",
  "Sanção",
  "Identificação pessoal",
  "Contrato e vínculos",
  "Remuneração e benefícios",
  "Desligamento",
] as const;

export function resolveDocumentCategoryOptions(
  cadastroItems: ReadonlyArray<{ valor: string }> | undefined,
): string[] {
  const fromCadastro = [...new Set((cadastroItems ?? []).map((item) => String(item.valor ?? "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
  if (fromCadastro.length > 0) return fromCadastro;
  return [...DEFAULT_DOCUMENT_CATEGORY_LABELS];
}

export const ORGANICO_DOCUMENT_CATEGORY_OPTIONS = [
  { id: "admission", label: "Admissão" },
  { id: "identification", label: "Identificação pessoal" },
  { id: "contract", label: "Contrato e vínculos" },
  { id: "payroll", label: "Remuneração e benefícios" },
  { id: "medical", label: "Atestados e saúde" },
  { id: "disciplinary", label: "Sanções disciplinares" },
  { id: "termination", label: "Desligamento" },
] as const;

export type OrganicoDocumentCategoryId = (typeof ORGANICO_DOCUMENT_CATEGORY_OPTIONS)[number]["id"];

export const ORGANICO_DOCUMENT_SECURITY_POLICY = {
  maxFileSizeMb: 20,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  requiresPrivateStorage: true,
  requiresServerSideValidation: true,
  requiresAuditLog: true,
} as const;

export function buildDocumentClassificationAccess(defaultValue = false): Record<OrganicoDocumentClassificationId, boolean> {
  return Object.fromEntries(
    ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS.map((item) => [item.id, defaultValue]),
  ) as Record<OrganicoDocumentClassificationId, boolean>;
}

export function buildDocumentCategoryAccess(defaultValue = false): Record<OrganicoDocumentCategoryId, boolean> {
  return Object.fromEntries(
    ORGANICO_DOCUMENT_CATEGORY_OPTIONS.map((item) => [item.id, defaultValue]),
  ) as Record<OrganicoDocumentCategoryId, boolean>;
}
