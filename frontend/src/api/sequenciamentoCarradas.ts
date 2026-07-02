import { apiFetch } from './client';

export type SequenciamentoCarradaAgregada = {
  cod: string;
  carrada: string;
  saldoAFaturar: number;
  saldoEmDia: number;
  percentualEmDia: number;
  adiantamento: number;
  valorAVistaAte10d: number;
};

export type SequenciamentoCarradasPayloadV1 = {
  version: 1;
  geradoEm: string;
  carradas: SequenciamentoCarradaAgregada[];
  linhas: Record<string, unknown>[];
};

export type SequenciamentoSnapshotListItem = {
  id: number;
  cod: string;
  usuarioLogin: string;
  createdAt: string;
  carradaCount: number;
};

export type SequenciamentoSnapshotDetalhe = SequenciamentoSnapshotListItem & {
  payload: SequenciamentoCarradasPayloadV1 | null;
};

export type SequenciamentoConsultaAoVivo = {
  aoVivo: true;
  geradoEm: string;
  carradaCount: number;
  payload: SequenciamentoCarradasPayloadV1;
};

export async function gravarSequenciamentoSnapshot(): Promise<{
  ok: boolean;
  id?: number;
  cod?: string;
  createdAt?: string;
  usuarioLogin?: string;
  carradaCount?: number;
  error?: string;
}> {
  const res = await apiFetch('/api/pedidos/sequenciamento-carradas/snapshots', { method: 'POST', body: {} });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { error: text || res.statusText };
    }
  }
  if (!res.ok) return { ok: false, error: String(body.error ?? res.statusText) };
  return {
    ok: true,
    id: body.id as number,
    cod: body.cod as string,
    createdAt: body.createdAt as string,
    usuarioLogin: body.usuarioLogin as string,
    carradaCount: body.carradaCount as number,
  };
}

export async function consultarSequenciamentoAoVivo(): Promise<{
  data?: SequenciamentoConsultaAoVivo;
  error?: string;
}> {
  const res = await apiFetch('/api/pedidos/sequenciamento-carradas/consulta-ao-vivo');
  const text = await res.text();
  let body: SequenciamentoConsultaAoVivo & { error?: string } = {} as SequenciamentoConsultaAoVivo & {
    error?: string;
  };
  if (text) {
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return { error: text || res.statusText };
    }
  }
  if (!res.ok) return { error: body.error ?? res.statusText };
  return { data: body };
}

export async function listarSequenciamentoSnapshots(limit = 100): Promise<{
  data: SequenciamentoSnapshotListItem[];
  error?: string;
}> {
  const res = await apiFetch(
    `/api/pedidos/sequenciamento-carradas/snapshots?limit=${encodeURIComponent(String(limit))}`
  );
  const text = await res.text();
  let body: { data?: SequenciamentoSnapshotListItem[]; error?: string } = {};
  if (text) {
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      body = { error: text || res.statusText };
    }
  }
  if (!res.ok) return { data: [], error: body.error ?? res.statusText };
  return { data: Array.isArray(body.data) ? body.data : [] };
}

export async function obterSequenciamentoSnapshot(id: number): Promise<{
  data?: SequenciamentoSnapshotDetalhe;
  error?: string;
}> {
  const res = await apiFetch(`/api/pedidos/sequenciamento-carradas/snapshots/${id}`);
  const text = await res.text();
  let body: SequenciamentoSnapshotDetalhe & { error?: string } = {} as SequenciamentoSnapshotDetalhe & {
    error?: string;
  };
  if (text) {
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return { error: text || res.statusText };
    }
  }
  if (!res.ok) return { error: body.error ?? res.statusText };
  return { data: body };
}
