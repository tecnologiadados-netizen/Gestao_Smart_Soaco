import type { DueStatus } from "@qualidade/types/calibration";
import type {
  DocumentOrigem,
  DocumentStatus,
  PermissaoAcessoDocumento,
} from "@qualidade/types/document";
import type { Department, DocumentType, User } from "@qualidade/types/user";
import {
  documentOrigemLabels,
  documentStatusLabels,
  dueStatusLabels,
} from "@qualidade/lib/utils/status-labels";

export function userSelectLabel(
  users: User[],
  id: string
): string | undefined {
  return users.find((u) => u.id === id)?.nome;
}

/**
 * Rótulo de responsável: nome do usuário vinculado, ou o texto livre
 * guardado no campo (ex.: migracao de ex-colaboradores).
 */
export function labelResponsavel(
  users: User[],
  id: string | null | undefined,
  fallback = "—"
): string {
  const raw = (id ?? "").trim();
  if (!raw) return fallback;
  return users.find((u) => u.id === raw)?.nome ?? raw;
}

export function departmentSelectLabel(
  departments: Department[],
  id: string,
  _format?: "nome" | "sigla-nome"
): string | undefined {
  return departments.find((d) => d.id === id)?.nome;
}

export function documentTypeSelectLabel(
  types: DocumentType[],
  id: string
): string | undefined {
  const type = types.find((t) => t.id === id);
  return type ? `${type.sigla} — ${type.nome}` : undefined;
}

export function documentOrigemFilterLabel(value: string): string | undefined {
  if (value === "todos") return "Todos os tipos";
  return documentOrigemLabels[value as DocumentOrigem];
}

export function documentStatusFilterLabel(value: string): string | undefined {
  if (value === "todos") return "Todos os status";
  return documentStatusLabels[value as DocumentStatus];
}

export function departmentFilterLabel(
  departments: Department[],
  value: string
): string | undefined {
  if (value === "todos") return "Todos os setores";
  return departmentSelectLabel(departments, value);
}

const permissaoAcessoLabels: Record<PermissaoAcessoDocumento, string> = {
  todos: "Todos",
  restrito: "Restrito",
  responsavel: "Apenas responsável",
};

export function permissaoAcessoSelectLabel(
  value: string
): string | undefined {
  if (!value) return undefined;
  return permissaoAcessoLabels[value as PermissaoAcessoDocumento];
}

const validadeModoLabels = {
  periodo: "Por período (dias)",
  data: "Data específica",
} as const;

export function validadeModoSelectLabel(
  value: string
): string | undefined {
  return validadeModoLabels[value as keyof typeof validadeModoLabels];
}

const tipoCalibracaoLabels = {
  interna: "Interna",
  externa: "Externa",
  ambos: "Ambos",
} as const;

export function tipoCalibracaoSelectLabel(
  value: string
): string | undefined {
  return tipoCalibracaoLabels[value as keyof typeof tipoCalibracaoLabels];
}

export function tipoCalibracaoFilterLabel(value: string): string | undefined {
  if (value === "todos") return "Todos os tipos";
  return tipoCalibracaoSelectLabel(value);
}

export function calibrationStatusFilterLabel(value: string): string | undefined {
  if (value === "todos") return "Todos os status";
  if (value === "inativo") return "Inativo";
  return dueStatusLabels[value as DueStatus];
}

export function userFilterLabel(users: User[], value: string): string | undefined {
  if (value === "todos") return "Todos os responsáveis";
  return userSelectLabel(users, value);
}

const acaoRevalidacaoLabels = {
  prorrogar: "Não — apenas prorrogar validade",
  nova_revisao: "Sim — gerar nova revisão",
} as const;

export function acaoRevalidacaoSelectLabel(
  value: string
): string | undefined {
  return acaoRevalidacaoLabels[value as keyof typeof acaoRevalidacaoLabels];
}
