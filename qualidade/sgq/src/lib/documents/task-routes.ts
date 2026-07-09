import type { Task } from "@/types/task";

export function getTaskActionHref(task: Task): string {
  const base = `/documentos/${task.referenciaId}`;

  switch (task.tipo) {
    case "elaborar_documento":
      return `${base}/elaborar`;
    case "consenso_documento":
      return `${base}/consenso`;
    case "aprovar_documento":
      return `${base}/aprovacao`;
    case "revalidar_documento":
      return `/documentos?revalidar=${task.referenciaId}`;
    case "revisar_documento":
      return `${base}/elaborar`;
    default:
      return base;
  }
}

export function getTaskActionLabel(task: Task): string {
  switch (task.tipo) {
    case "elaborar_documento":
      return "Iniciar elaboração";
    case "consenso_documento":
      return "Registrar consenso";
    case "aprovar_documento":
      return "Iniciar aprovação";
    case "revalidar_documento":
      return "Revalidar documento";
    case "revisar_documento":
      return "Revisar documento";
    default:
      return "Abrir documento";
  }
}
