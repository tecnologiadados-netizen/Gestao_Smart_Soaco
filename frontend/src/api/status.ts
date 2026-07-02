import { apiFetch, apiJson } from './client';

export interface StatusResponse {
  lastUpload: string | null;
  lastSyncErp: string | null;
  nomusOk?: boolean;
  nomusError?: string | null;
}

export async function getStatus(): Promise<StatusResponse> {
  return apiJson<StatusResponse>('/api/status');
}

/** Força nova consulta ao ERP (Nomus) e atualiza lastSyncErp. */
export async function sincronizar(): Promise<void> {
  const res = await apiFetch('/api/pedidos/sincronizar', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = body as { error?: string; detalhe?: string };
    const msg = err.detalhe
      ? `${err.error ?? 'Erro ao sincronizar'}: ${err.detalhe}`
      : (err.error ?? 'Erro ao sincronizar');
    throw new Error(msg);
  }
}

/** Formata ISO para "dd/mm/aaaa às HH:MM". */
export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
}
