export type UserRole =
  | "admin"
  | "gestor_qualidade"
  | "elaborador"
  | "revisor"
  | "aprovador"
  | "operador";

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  setorId: string;
  ativo: boolean;
}

export interface Department {
  id: string;
  nome: string;
}

export interface DocumentType {
  id: string;
  nome: string;
  sigla: string;
}
