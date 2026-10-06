/**
 * Cliente REST do Nomus para o PDV. A credencial fica só no ambiente do servidor.
 */

const CACHE_MS = 5 * 60 * 1000;

type CacheEntry = { at: number; data: unknown };

const cache = new Map<string, CacheEntry>();

export function nomusRestConfigurado(): boolean {
  return Boolean(process.env.NOMUS_REST_BASIC?.trim() && baseUrl());
}

function baseUrl(): string {
  return (process.env.NOMUS_REST_BASE_URL?.trim() || 'https://soaco.nomus.com.br/soaco/rest').replace(/\/+$/, '');
}

function authorization(): string {
  const raw = process.env.NOMUS_REST_BASIC?.trim() ?? '';
  if (!raw) {
    throw new Error('Integração Nomus REST não configurada. Defina NOMUS_REST_BASIC no backend/.env.');
  }
  return /^basic\s+/i.test(raw) ? raw : `Basic ${raw}`;
}

export async function nomusRest<T>(path: string, init?: RequestInit & { cacheMs?: number }): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheMs = init?.cacheMs ?? (method === 'GET' ? CACHE_MS : 0);
  if (cacheMs > 0) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < cacheMs) return hit.data as T;
  }

  const headers: Record<string, string> = {
    Authorization: authorization(),
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const { cacheMs: _cacheMs, ...pedido } = init ?? {};
  void _cacheMs;
  const res = await fetch(url, { ...pedido, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Nomus ${method} ${path} falhou (HTTP ${res.status}). ${text.slice(0, 280)}`);
  }
  const data = (text ? JSON.parse(text) : null) as T;
  if (cacheMs > 0) cache.set(url, { at: Date.now(), data });
  return data;
}

export function limparCacheNomusRest(): void {
  cache.clear();
}

export function comoLista<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['content', 'itens', 'data', 'registros']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function idDe(obj: Record<string, unknown> | null | undefined): number | null {
  if (!obj) return null;
  const raw = obj.id ?? obj.idPedido ?? obj.idDocumento;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
