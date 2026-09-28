import type { DocumentOrigem, DocumentStatus } from "@qualidade/types/document";
import type { DueStatus } from "@qualidade/types/calibration";
import type { TaskType } from "@qualidade/types/task";
import { isInitialRevision } from "@qualidade/lib/documents/revision";

export const documentStatusLabels: Record<DocumentStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  em_aprovacao: "Em aprovação",
  vigente: "Vigente",
  obsoleto: "Obsoleto",
};

const STATUS_CADASTRO: DocumentStatus[] = [
  "rascunho",
  "em_revisao",
  "em_aprovacao",
];

/** Rótulo da consulta: "Em revisão" só na revisão de um documento já publicado. */
export function rotuloStatusDocumento(
  status: DocumentStatus,
  versaoAtual?: string
): string {
  const cadastroInicial = !versaoAtual || isInitialRevision(versaoAtual);
  if (!cadastroInicial && STATUS_CADASTRO.includes(status)) {
    return "Em revisão";
  }
  if (cadastroInicial && status === "em_revisao") {
    return "Em consenso";
  }
  return documentStatusLabels[status];
}

export const documentOrigemLabels: Record<DocumentOrigem, string> = {
  interno: "Interno",
  externo: "Externo",
  registro: "Registro interno",
};

export const documentOrigemLabelsLong: Record<DocumentOrigem, string> = {
  interno: "Documento interno",
  externo: "Documento externo",
  registro: "Registro interno",
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
