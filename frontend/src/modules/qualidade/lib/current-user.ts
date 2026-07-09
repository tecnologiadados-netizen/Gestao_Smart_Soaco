import { useConfigStore } from '@qualidade/lib/store/config-store';

export function getQualidadeCurrentUserId(): string {
  return useConfigStore.getState().currentUserId;
}
