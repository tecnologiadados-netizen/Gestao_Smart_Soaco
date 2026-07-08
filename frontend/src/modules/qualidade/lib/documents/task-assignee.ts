import { getQualidadeCurrentUserId } from '@qualidade/lib/current-user';

/** Quando true, todas as pendências vão para o usuário logado (apenas testes locais). */
export const DEV_ROUTE_ALL_TASKS_TO_CURRENT_USER = false;

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
