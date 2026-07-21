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

/** Estado da simulação (datas editadas e ordem manual das carradas) gravado junto ao snapshot. */
export type SequenciamentoSimulacaoItem = {
  chave: string;
  cod: string;
  carrada: string;
  dataProducao?: string | null;
  dataEntrega?: string | null;
};

export type SequenciamentoSimulacao = {
  ordem: string[];
  itens: SequenciamentoSimulacaoItem[];
  /** Prioridade manual por chave de carrada (maior = mais acima). */
  prioridades?: Record<string, number>;
  /** Rascunho de motivos por id_pedido (registro de motivos do fluxo de confirmação). */
  motivos?: Record<string, string>;
  /** Rascunho de observações por id_pedido (mesmo fluxo do Gerenciador). */
  observacoes?: Record<string, string>;
  /** Previsão confiável por id_pedido (`false` = provisória). Ausente = true. */
  previsaoConfiavel?: Record<string, boolean>;
};

/** Fluxo do snapshot: 'rascunho' (editável, autosave) -> 'concluido' (somente leitura). */
export type SequenciamentoSnapshotStatus = 'rascunho' | 'concluido';

export type SequenciamentoCarradasPayloadV1 = {
  version: 1 | 2;
  geradoEm: string;
  carradas: SequenciamentoCarradaAgregada[];
  linhas: Record<string, unknown>[];
  /** Presente apenas em snapshots v2 (gravados com simulação). */
  simulacao?: SequenciamentoSimulacao | null;
};

export type SequenciamentoSnapshotListItem = {
  id: number;
  cod: string;
  usuarioLogin: string;
  createdAt: string;
  carradaCount: number;
  status: SequenciamentoSnapshotStatus;
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

export async function gravarSequenciamentoSnapshot(simulacao?: SequenciamentoSimulacao | null): Promise<{
  ok: boolean;
  id?: number;
  cod?: string;
  createdAt?: string;
  usuarioLogin?: string;
  carradaCount?: number;
  status?: SequenciamentoSnapshotStatus;
  error?: string;
}> {
  const res = await apiFetch('/api/pedidos/sequenciamento-carradas/snapshots', {
    method: 'POST',
    body: simulacao ? { simulacao } : {},
  });
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
    status: (body.status as SequenciamentoSnapshotStatus) ?? 'rascunho',
  };
}

/** Autosave do rascunho: atualiza a simulação (datas/ordem/motivos) do snapshot. */
export async function atualizarSequenciamentoSnapshot(
  id: number,
  simulacao: SequenciamentoSimulacao | null,
  opts?: { keepalive?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/pedidos/sequenciamento-carradas/snapshots/${id}`, {
    method: 'PATCH',
    body: { simulacao },
    ...(opts?.keepalive ? { keepalive: true } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return { ok: false, error: (err as { error?: string }).error ?? res.statusText };
  }
  return { ok: true };
}

/** Marca o snapshot como concluído (status final; somente leitura). */
export async function concluirSequenciamentoSnapshot(
  id: number,
  simulacao?: SequenciamentoSimulacao | null
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/pedidos/sequenciamento-carradas/snapshots/${id}/concluir`, {
    method: 'POST',
    body: simulacao !== undefined ? { simulacao } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return { ok: false, error: (err as { error?: string }).error ?? res.statusText };
  }
  return { ok: true };
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

/** Exclui snapshot em rascunho. */
export async function excluirSequenciamentoSnapshot(id: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await apiFetch(`/api/pedidos/sequenciamento-carradas/snapshots/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return { ok: false, error: (err as { error?: string }).error ?? res.statusText };
  }
  return { ok: true };
}
