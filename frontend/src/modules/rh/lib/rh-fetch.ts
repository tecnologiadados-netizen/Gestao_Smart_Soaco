import { getApiBase, getCsrfToken, getStoredToken } from '@/api/client';

export const RH_API_BASE = '/api/rh';

export function rhApiPath(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${RH_API_BASE}/${clean}`;
}

export function isRhApiConfigured(): boolean {
  return true;
}

async function buildRhHeaders(
  extra: Record<string, string> = {},
  method = 'GET',
  isFormData = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extra };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') {
    const csrf = await getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  if (!isFormData && method !== 'GET' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function parseRhApiError(res: Response, path: string): Promise<string> {
  let msg = `API ${path}: ${res.status}`;
  try {
    const text = await res.text();
    if (text.trim()) {
      try {
        const j = JSON.parse(text) as { error?: string };
        if (typeof j?.error === 'string' && j.error.trim()) msg = j.error.trim();
        else msg = `${msg} — ${text.trim().slice(0, 240)}`;
      } catch {
        msg = `${msg} — ${text.trim().slice(0, 240)}`;
      }
    }
  } catch {
    /* ignorar */
  }
  return msg;
}

export async function rhFetch(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Response> {
  const { method = 'GET', body, headers: extraHeaders, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = await buildRhHeaders(extraHeaders as Record<string, string>, method, isFormData);
  const base = getApiBase();
  return fetch(`${base}${rhApiPath(path)}`, {
    ...rest,
    method,
    credentials: 'include',
    headers,
    body:
      body == null
        ? undefined
        : isFormData
          ? (body as FormData)
          : method !== 'GET'
            ? JSON.stringify(body)
            : undefined,
  });
}

export async function rhFetchJson<T>(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await rhFetch(path, options);
  if (!res.ok) throw new Error(await parseRhApiError(res, path));
  return res.json() as Promise<T>;
}

/** Compatibilidade com código que ainda chama getRequiredRhSessionToken. */
export function getRequiredRhSessionToken(): string {
  const token = getStoredToken()?.trim();
  if (!token) throw new Error('Sessão expirada. Entre novamente para continuar.');
  return token;
}
