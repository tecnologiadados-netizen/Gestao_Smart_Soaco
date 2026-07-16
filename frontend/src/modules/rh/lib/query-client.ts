import { QueryClient } from '@tanstack/react-query';

export const rhQueryClient = new QueryClient();

rhQueryClient.setQueryDefaults(['organico'], {
  staleTime: 5 * 60 * 1000,
  gcTime: 15 * 60 * 1000,
  refetchOnWindowFocus: false,
});
