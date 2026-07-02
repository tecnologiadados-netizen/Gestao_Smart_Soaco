import { apiFetch } from './client';

export interface EvolutionConnectResponse {
  configured: boolean;
  connected?: boolean;
  instance?: string;
  instanceFromEnv?: boolean;
  /** true quando instância e número estão configurados (banco ou .env) para envio */
  instanceConfiguredInEnv?: boolean;
  storedNumber?: string | null;
  qrCodeBase64?: string;
  pairingCode?: string;
  message?: string;
  error?: string;
  envHint?: string;
}

export async function getEvolutionConnect(): Promise<EvolutionConnectResponse> {
  const res = await apiFetch('/api/evolution/connect');
  const text = await res.text();
  let data: EvolutionConnectResponse & { error?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // 502/504 podem vir como HTML
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Erro ${res.status}`);
  }
  return data as EvolutionConnectResponse;
}

export interface EvolutionConfigResponse {
  configured: boolean;
  url?: string;
  instance?: string;
  connected?: boolean;
}

export async function getEvolutionConfig(): Promise<EvolutionConfigResponse> {
  const res = await apiFetch('/api/evolution/config');
  return res.json();
}

/** Salva instância e número para envio (persistido no backend). */
export async function saveEvolutionConfig(instance: string, number: string): Promise<void> {
  const res = await apiFetch('/api/evolution/save-config', {
    method: 'POST',
    body: { instance, number },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar');
  }
}

/** Desconecta a instância uazapiGO (logout no WhatsApp). */
export async function logoutEvolution(): Promise<void> {
  const res = await apiFetch('/api/evolution/logout', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao desconectar');
  }
}
