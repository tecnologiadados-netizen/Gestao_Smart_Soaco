import { getQualidadeCurrentUserId } from '@qualidade/lib/current-user';

/**
 * Enquanto o fluxo por usuário está em desenvolvimento, todas as pendências
 * são atribuídas ao usuário logado para facilitar os testes.
 */
export const DEV_ROUTE_ALL_TASKS_TO_CURRENT_USER = true;

export function resolveTaskAssignee(intendedUserId?: string): string {
  const current = getQualidadeCurrentUserId();
  if (DEV_ROUTE_ALL_TASKS_TO_CURRENT_USER) return current;
  return intendedUserId ?? current;
}

export function computeTaskDeadline(fromIso: string, days: number): string {
  const date = new Date(fromIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
