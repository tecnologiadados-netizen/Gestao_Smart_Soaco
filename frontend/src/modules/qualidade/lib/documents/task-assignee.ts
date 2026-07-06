import { CURRENT_USER_ID } from "@qualidade/lib/mock-data/users";

/**
 * Enquanto o fluxo por usuário está em desenvolvimento, todas as pendências
 * são atribuídas ao usuário logado (Davi) para facilitar os testes.
 */
export const DEV_ROUTE_ALL_TASKS_TO_CURRENT_USER = true;

export function resolveTaskAssignee(intendedUserId?: string): string {
  if (DEV_ROUTE_ALL_TASKS_TO_CURRENT_USER) return CURRENT_USER_ID;
  return intendedUserId ?? CURRENT_USER_ID;
}

export function computeTaskDeadline(fromIso: string, days: number): string {
  const date = new Date(fromIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
