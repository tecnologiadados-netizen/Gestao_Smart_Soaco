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

/** Estado da simula??o (datas editadas e ordem manual das carradas) gravado junto ao snapshot. */
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
  /** Rascunho de motivos por id_pedido (registro de motivos do fluxo de confirma??o). */
  motivos?: Record<string, string>;
  /** Rascunho de observa??es por id_pedido (mesmo fluxo do Gerenciador). */
  observacoes?: Record<string, string>;
  /** Previs?o confi?vel por id_pedido (`false` = provis?ria). Ausente = true. */
  previsaoConfiavel?: Record<string, boolean>;
};

/** Fluxo do snapshot: 'rascunho' (edit?vel, autosave) -> 'concluido' (somente leitura). */
export type SequenciamentoSnapshotStatus = 'rascunho' | 'concluido';

export type SequenciamentoCarradasPayloadV1 = {
  version: 1 | 2;
  geradoEm: string;
  carradas: SequenciamentoCarradaAgregada[];
  linhas: Record<string, unknown>[];
  /** Presente apenas em snapshots v2 (gravados com simula??o). */
  simulacao?: SequenciamentoSimulacao | null;
  /** Saldo de estoque por c?digo no momento de `geradoEm` (ausente em snapshots legados). */
  estoquePorCod?: Record<string, number>;
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

/** Autosave do rascunho: atualiza a simula??o (datas/ordem/motivos) do snapshot. */
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

/** Marca o snapshot como conclu?do (status final; somente leitura). */
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

// ---------------------------------------------------------------------------
// Disponibilidade de materiais (Calendario de producao)
// ---------------------------------------------------------------------------

export type DemandaCalendarioMateriais = {
  codigoPa: string;
  qtde: number;
  dataIso: string;
  pd?: string;
  setor?: string;
  /** Rota/carrada da linha — exibida na origem do consumo. */
  carrada?: string;
};

/**
 * Quando informado, o backend calcula com a base congelada no Gravar daquela sequência
 * (sem consultar o Nomus). Ausente = consulta ao vivo.
 */
export type OpcoesFonteCalendario = { snapshotId?: number | null };

export type StatusMaterialDia = 'ok' | 'atencao' | 'falta';

export type StatusPorDataMateriais = {
  data: string;
  status: StatusMaterialDia;
  qtdeMateriaisFalta: number;
  qtdeMateriaisAtencao: number;
};

export type MaterialCriticoCalendario = {
  idProduto: number;
  codigo: string;
  descricao: string;
  primeiraDataFalta: string;
  faltaNaPrimeiraData: number;
};

export type DisponibilidadeMateriaisSintetica = {
  consultadoEm: string;
  datas: string[];
  statusPorData: StatusPorDataMateriais[];
  materiaisCriticos: MaterialCriticoCalendario[];
  qtdeMateriaisEscopo?: number;
};

export type MaterialDiaCalendario = {
  idProduto: number;
  codigo: string;
  descricao: string;
  consumoDia: number;
  saldoInicio: number;
  entradaDia: number;
  falta: number;
  status: StatusMaterialDia;
  /** Origem do consumo do dia (mesma fonte da célula). */
  origens: OrigemConsumoCalendario[];
};

export type HorizonteDiaCalendario = {
  data: string;
  consumo: number;
  entrada: number;
  saldoInicio: number;
  faltaAcum: number;
  status: StatusMaterialDia;
};

export type OrigemConsumoCalendario = {
  dataIso: string;
  carrada: string;
  pd: string;
  qtdeComponente: number;
};

async function parseJsonBodyDisponibilidade<T extends { error?: string }>(
  res: Response
): Promise<{ ok: boolean; body: T; error?: string }> {
  const text = await res.text();
  let body = {} as T;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      return { ok: false, body, error: text || res.statusText };
    }
  }
  if (!res.ok) return { ok: false, body, error: body.error ?? res.statusText };
  return { ok: true, body };
}

export async function consultarDisponibilidadeMateriaisSintetica(
  demanda: DemandaCalendarioMateriais[],
  opts?: { signal?: AbortSignal } & OpcoesFonteCalendario
): Promise<{ data?: DisponibilidadeMateriaisSintetica; error?: string }> {
  try {
    const res = await apiFetch(
      '/api/pedidos/sequenciamento-carradas/calendario-producao/disponibilidade-materiais',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // apiFetch já faz JSON.stringify — passar objeto cru.
        body: { demanda, snapshotId: opts?.snapshotId ?? null },
        signal: opts?.signal,
      }
    );
    const parsed = await parseJsonBodyDisponibilidade<
      DisponibilidadeMateriaisSintetica & { ok?: boolean; error?: string }
    >(res);
    if (!parsed.ok) return { error: parsed.error };
    const { ok: _ok, error: _e, ...data } = parsed.body;
    return { data };
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (/abort|AbortError/i.test(msg)) throw err;
    return { error: msg || 'Falha ao consultar disponibilidade de materiais.' };
  }
}

export async function consultarDisponibilidadeMateriaisDia(
  demanda: DemandaCalendarioMateriais[],
  dataIso: string,
  opts?: OpcoesFonteCalendario
): Promise<{
  data?: { consultadoEm: string; dataIso: string; materiais: MaterialDiaCalendario[] };
  error?: string;
}> {
  const res = await apiFetch(
    '/api/pedidos/sequenciamento-carradas/calendario-producao/disponibilidade-materiais/dia',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { demanda, dataIso, snapshotId: opts?.snapshotId ?? null },
    }
  );
  const parsed = await parseJsonBodyDisponibilidade<{
    ok?: boolean;
    error?: string;
    consultadoEm: string;
    /** Novo campo; legado usava `data`. */
    dataIso?: string;
    data?: string;
    materiais: MaterialDiaCalendario[];
  }>(res);
  if (!parsed.ok) return { error: parsed.error };
  return {
    data: {
      consultadoEm: parsed.body.consultadoEm,
      dataIso: parsed.body.dataIso ?? parsed.body.data ?? dataIso,
      materiais: parsed.body.materiais ?? [],
    },
  };
}

export async function consultarDisponibilidadeMateriaisItem(
  demanda: DemandaCalendarioMateriais[],
  codigoComponente: string,
  opts?: OpcoesFonteCalendario
): Promise<{
  data?: {
    consultadoEm: string;
    idProduto: number;
    codigo: string;
    descricao: string;
    saldoInicial: number;
    dias: HorizonteDiaCalendario[];
    origens: OrigemConsumoCalendario[];
  };
  error?: string;
}> {
  const res = await apiFetch(
    '/api/pedidos/sequenciamento-carradas/calendario-producao/disponibilidade-materiais/item',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { demanda, codigoComponente, snapshotId: opts?.snapshotId ?? null },
    }
  );
  const parsed = await parseJsonBodyDisponibilidade<{
    ok?: boolean;
    error?: string;
    consultadoEm: string;
    idProduto: number;
    codigo: string;
    descricao: string;
    saldoInicial: number;
    dias: HorizonteDiaCalendario[];
    origens: OrigemConsumoCalendario[];
  }>(res);
  if (!parsed.ok) return { error: parsed.error };
  const b = parsed.body;
  return {
    data: {
      consultadoEm: b.consultadoEm,
      idProduto: b.idProduto,
      codigo: b.codigo,
      descricao: b.descricao,
      saldoInicial: b.saldoInicial,
      dias: b.dias ?? [],
      origens: b.origens ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Consultas congeladas no snapshot da sequência
// ---------------------------------------------------------------------------

/** PC pendente congelado no Gravar (modal "PC Pend" do Horizonte). */
export async function obterPcPendCongelado(
  snapshotId: number,
  idProduto: number
): Promise<{ data: PcPendCongeladoLinha[]; error?: string }> {
  const res = await apiFetch(
    `/api/pedidos/sequenciamento-carradas/snapshots/${snapshotId}/pc-pend?idProduto=${encodeURIComponent(
      String(idProduto)
    )}`
  );
  const body = (await res.json().catch(() => ({}))) as { data?: PcPendCongeladoLinha[]; error?: string };
  if (!res.ok) return { data: [], error: body.error ?? res.statusText };
  return { data: body.data ?? [] };
}

export type PcPendCongeladoLinha = { pedidoCompra: string; qtde: number; dataEntrega: string | null };

export type TipoConsultaCongelada = 'estoque' | 'saldoSetor' | 'empenhoPedido';

/**
 * Consulta congelada sob demanda: a primeira abertura consulta o Nomus e persiste o resultado
 * no snapshot; as seguintes leem o valor gravado.
 */
export async function consultarCongeladaSnapshot<T>(
  snapshotId: number,
  tipo: TipoConsultaCongelada,
  params: { codigo?: string; idProduto?: number; considerarRequisicoes?: boolean }
): Promise<{ body?: T & { capturadoEm?: string }; error?: string }> {
  const res = await apiFetch(
    `/api/pedidos/sequenciamento-carradas/snapshots/${snapshotId}/consulta-congelada`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { tipo, ...params },
    }
  );
  const text = await res.text();
  let parsed = {} as T & { capturadoEm?: string; error?: string };
  if (text) {
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      return { error: text || res.statusText };
    }
  }
  if (!res.ok) return { error: parsed.error ?? res.statusText };
  return { body: parsed };
}
