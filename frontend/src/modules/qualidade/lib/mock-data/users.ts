import type { Department, DocumentType, User } from "@qualidade/types/user";

export const CURRENT_USER_ID = "user-davi";

export const departments: Department[] = [
  { id: "dep-producao", nome: "Produção" },
  { id: "dep-qualidade", nome: "Qualidade" },
  { id: "dep-manutencao", nome: "Manutenção" },
  { id: "dep-laboratorio", nome: "Laboratório" },
];

export const documentTypes: DocumentType[] = [
  { id: "tipo-po", nome: "Procedimento Operacional", sigla: "PO" },
  { id: "tipo-it", nome: "Instrução de Trabalho", sigla: "IT" },
  { id: "tipo-fo", nome: "Formulário", sigla: "FO" },
  { id: "tipo-man", nome: "Manual", sigla: "MAN" },
  { id: "tipo-re", nome: "Registro", sigla: "RE" },
];

export const users: User[] = [
  {
    id: "user-davi",
    nome: "Davi",
    email: "davi@soacoindustrial.com.br",
    role: "gestor_qualidade",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-maria",
    nome: "Maria Silva",
    email: "maria@soacoindustrial.com.br",
    role: "revisor",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-carlos",
    nome: "Carlos Mendes",
    email: "carlos@soacoindustrial.com.br",
    role: "aprovador",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-ana",
    nome: "Ana Costa",
    email: "ana@soacoindustrial.com.br",
    role: "elaborador",
    setorId: "dep-producao",
    ativo: true,
  },
  {
    id: "user-admin",
    nome: "Administrador",
    email: "admin@soacoindustrial.com.br",
    role: "admin",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-barbara-quelly",
    nome: "Bárbara Quelly",
    email: "barbara.quelly@soacoindustrial.com.br",
    role: "gestor_qualidade",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-fernanda-soares",
    nome: "Fernanda Soares",
    email: "fernanda.soares@soacoindustrial.com.br",
    role: "gestor_qualidade",
    setorId: "dep-qualidade",
    ativo: true,
  },
  {
    id: "user-importacao-erp",
    nome: "Importação ERP",
    email: "erp@soacoindustrial.com.br",
    role: "gestor_qualidade",
    setorId: "dep-qualidade",
    ativo: false,
  },
];

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getDepartmentById(id: string): Department | undefined {
  return departments.find((d) => d.id === id);
}

export function getDocumentTypeById(id: string): DocumentType | undefined {
  return documentTypes.find((t) => t.id === id);
}
