import { apiFetch } from './client';

export interface AiSettingsResponse {
  configured: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }
}

export async function fetchAiSettings(): Promise<AiSettingsResponse> {
  const res = await apiFetch('/api/ai-settings');
  const data = await readApiJson<AiSettingsResponse & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar credencial do Assistente IA');
  return data;
}

export async function saveAiSettings(input: {
  model: string;
  apiKey?: string;
}): Promise<{ ok: boolean; settings: AiSettingsResponse }> {
  const res = await apiFetch('/api/ai-settings', {
    method: 'PUT',
    body: { provider: 'openai', ...input },
  });
  const data = await readApiJson<{ ok?: boolean; settings?: AiSettingsResponse; error?: string }>(res);
  if (!res.ok || !data.settings) throw new Error(data.error ?? 'Erro ao salvar');
  return { ok: true, settings: data.settings };
}

export async function testAiSettings(): Promise<{
  ok: boolean;
  reply?: string;
  settings: AiSettingsResponse;
}> {
  const res = await apiFetch('/api/ai-settings/test', {
    method: 'POST',
    body: {},
  });
  const data = await readApiJson<{
    ok?: boolean;
    reply?: string;
    settings?: AiSettingsResponse;
    error?: string;
  }>(res);
  if (!res.ok || !data.settings) throw new Error(data.error ?? 'Erro ao testar');
  return { ok: Boolean(data.ok), reply: data.reply, settings: data.settings };
}
