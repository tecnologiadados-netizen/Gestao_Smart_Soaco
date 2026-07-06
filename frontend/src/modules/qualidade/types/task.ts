export type TaskType =
  | "revisar_documento"
  | "aprovar_documento"
  | "elaborar_documento"
  | "consenso_documento"
  | "revalidar_documento"
  | "verificar_equipamento"
  | "calibrar_equipamento";

export type TaskStatus = "pendente" | "concluida" | "cancelada";

export interface Task {
  id: string;
  tipo: TaskType;
  titulo: string;
  descricao?: string;
  referenciaId: string;
  referenciaTipo: "documento" | "equipamento";
  responsavelId: string;
  prazo?: string;
  status: TaskStatus;
  createdAt: string;
}
