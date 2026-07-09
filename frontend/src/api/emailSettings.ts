import { apiFetch } from './client';

export interface EmailSettingsResponse {
  configured: boolean;
  provider: string;
  fromEmail: string;
  fromName: string;
  clientId: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  credentialBlockedAt: string | null;
  credentialBlockCode: string | null;
  credentialBlockSummary: string | null;
  updatedAt: string | null;
}

export interface SaveEmailSettingsInput {
  provider?: 'gmail_api';
  fromEmail: string;
  fromName: string;
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
  testTo?: string;
}

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
    if (snippet.includes('<!DOCTYPE') || snippet.includes('<html')) {
      throw new Error(
        'A API retornou HTML em vez de JSON. O backend precisa ser atualizado e reiniciado (rota /api/email-settings ausente).'
      );
    }
    throw new Error(`Resposta inválida do servidor: ${snippet}`);
  }
}

export async function fetchEmailSettings(): Promise<EmailSettingsResponse> {
  const res = await apiFetch('/api/email-settings');
  const data = await readApiJson<EmailSettingsResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? 'Erro ao carregar credencial de e-mail');
  }
  return data;
}

export async function saveEmailSettings(
  payload: SaveEmailSettingsInput
): Promise<{ ok: boolean; settings: EmailSettingsResponse }> {
  const res = await apiFetch('/api/email-settings', {
    method: 'POST',
    body: payload,
  });
  const data = await readApiJson<{ ok?: boolean; settings?: EmailSettingsResponse; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? 'Erro ao salvar credencial de e-mail');
  }
  return data as { ok: boolean; settings: EmailSettingsResponse };
}

export async function sendTestEmail(
  to: string
): Promise<{
  ok: boolean;
  message: string;
  sentAt?: string;
  to?: string;
  from?: string;
  settings: EmailSettingsResponse;
}> {
  const res = await apiFetch('/api/email-settings/test', {
    method: 'POST',
    body: { to: to.trim() },
  });
  const data = await readApiJson<{
    ok?: boolean;
    message?: string;
    sentAt?: string;
    to?: string;
    from?: string;
    settings?: EmailSettingsResponse;
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? 'Falha ao enviar e-mail de teste');
  }
  return {
    ok: true,
    message: data.message ?? 'E-mail de teste enviado.',
    sentAt: data.sentAt,
    to: data.to,
    from: data.from,
    settings: data.settings as EmailSettingsResponse,
  };
}
