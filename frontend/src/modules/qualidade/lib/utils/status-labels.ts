import type { DocumentOrigem, DocumentStatus } from "@qualidade/types/document";
import type { DueStatus } from "@qualidade/types/calibration";
import type { TaskType } from "@qualidade/types/task";

export const documentStatusLabels: Record<DocumentStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  em_aprovacao: "Em aprovação",
  vigente: "Vigente",
  obsoleto: "Obsoleto",
};

export const documentOrigemLabels: Record<DocumentOrigem, string> = {
  interno: "Interno",
  externo: "Externo",
  registro: "Registro",
};

export const documentOrigemLabelsLong: Record<DocumentOrigem, string> = {
  interno: "Documento interno",
  externo: "Documento externo",
  registro: "Registro",
};

export const dueStatusLabels: Record<DueStatus, string> = {
  em_dia: "Em dia",
  proximo: "Próximo do vencimento",
  vencido: "Vencido",
};

export const taskTypeLabels: Record<TaskType, string> = {
  revisar_documento: "Revisar documento",
  aprovar_documento: "Aprovar documento",
  elaborar_documento: "Elaborar documento",
  consenso_documento: "Consenso do documento",
  revalidar_documento: "Revalidar documento",
  verificar_equipamento: "Verificar equipamento",
  calibrar_equipamento: "Calibrar equipamento",
};

export function getDocumentStatusVariant(
  status: DocumentStatus
): "default" | "secondary" | "destructive" | "outline" {
  return status === "vigente" ? "default" : "outline";
}

export function getDocumentOrigemVariant(
  origem: DocumentOrigem
): "default" | "secondary" | "destructive" | "outline" {
  switch (origem) {
    case "interno":
      return "default";
    case "externo":
      return "outline";
    case "registro":
      return "secondary";
  }
}

export function getDueStatusVariant(
  status: DueStatus
): "default" | "secondary" | "destructive" | "outline" | "warning" {
  switch (status) {
    case "em_dia":
      return "default";
    case "proximo":
      return "warning";
    case "vencido":
      return "destructive";
  }
}
