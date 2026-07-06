export type WorkflowEtapa = "consenso" | "aprovacao";

export interface WorkflowMovimentacao {
  id: string;
  etapa: WorkflowEtapa;
  acao: "aprovacao" | "reprovacao";
  motivo?: string;
  usuarioId: string;
  data: string;
}
