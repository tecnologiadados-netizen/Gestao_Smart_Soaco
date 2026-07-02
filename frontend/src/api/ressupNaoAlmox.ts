import { apiFetch } from './client';

export interface RessupNaoAlmoxPcPendLinha {
  pedidoCompra: string;
  qtde: number;
  dataEntrega: string | null;
}

export type EstoqueEmProducaoNaoAlmox = {
  /** Sem pintura (ou total nos demais itens) */
  chaoFabrica: number;
  marcenaria: number;
  /** Fundíveis: estoque em produção com pintura */
  chaoFabricaComPintura?: number;
  marcenariaComPintura?: number;
};

export type RessupNaoAlmoxRowUserInputs = Partial<Record<string, string>> & {
  observacoes?: Partial<Record<'qtdeSug' | 'dataNecessSug' | 'qtdAprov' | 'dataNecessAprov', string>>;
  descSimplificada?: string;
  codigoPintado?: string | null;
  estoqueEmProducao?: EstoqueEmProducaoNaoAlmox;
  /** Total composto (ERP + manual) congelado ou calculado */
  estoqueTotal?: number;
  /** ERP Nomus pré-carregado ao filtrar (sem produção manual). */
  estoqueTotalErp?: number;
};

export type RessupNaoAlmoxAnalisePayloadV1 = {
  version: 1;
  columnDefs: { key: string; label: string }[];
  displayRows: Record<string, string>[];
  rawRows: Record<string, unknown>[];
  aplicado: { codigo: string; descricao: string; coleta: string; considerarRequisicoes?: boolean };
  userInputs?: Record<string, RessupNaoAlmoxRowUserInputs>;
  savedUi?: {
    colunasOcultas?: string[];
    columnFilters?: unknown;
    sort?: unknown;
    sortLevels?: unknown;
    colWidths?: Record<string, number>;
  };
};

export interface RessupNaoAlmoxAnaliseListItem {
  id: number;
  createdAt: string;
  usuarioLogin: string;
  resumoFiltros: string | null;
  linhaCount: number;
  status: string;
  processadoAt: string | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: string | null;
  usuarioLoginConcluido: string | null;
}

export interface RessupNaoAlmoxEstoqueSetor {
  tipo: string;
  id_setor: number;
  nome_setor: string;
  saldo: number;
}

export async function listarRessupNaoAlmoxRegistroPreview(params: {
  codigo?: string;
  descricao?: string;
  coleta?: string;
  considerarRequisicoes?: boolean;
}): Promise<{ data: Record<string, unknown>[]; error?: string; message?: string }> {
  const qs = new URLSearchParams();
  if (params.codigo) qs.set('codigo', params.codigo);
  if (params.descricao) qs.set('descricao', params.descricao);
  if (params.coleta) qs.set('coleta', params.coleta);
  if (params.considerarRequisicoes) qs.set('considerarRequisicoes', 'true');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await apiFetch(`/api/compras/ressup-nao-almox/registro-preview${qs.toString() ? `?${qs}` : ''}`, {
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        data: [],
        error:
          'A consulta ao Nomus ultrapassou o tempo máximo (2 min). Tente de novo em horário de menor carga ou verifique rede/ERP.',
      };
    }
    throw e;
  }
  clearTimeout(timeoutId);
  let body: { data?: Record<string, unknown>[]; error?: string; message?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { data: [], error: 'Resposta inválida do servidor.' };
  }
  if (!res.ok) return { data: [], error: body.error ?? `Erro ${res.status}` };
  return { data: body.data ?? [], message: body.message };
}

export async function obterRessupNaoAlmoxPcPendDetalhes(
  idProduto: number
): Promise<{ data: RessupNaoAlmoxPcPendLinha[]; error?: string }> {
  const res = await apiFetch(
    `/api/compras/ressup-nao-almox/pc-pend-detalhes?idProduto=${encodeURIComponent(String(idProduto))}`
  );
  let body: { data?: RessupNaoAlmoxPcPendLinha[]; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { data: [], error: 'Resposta inválida.' };
  }
  if (!res.ok) return { data: [], error: body.error ?? `Erro ${res.status}` };
  return { data: body.data ?? [] };
}

export type RessupNaoAlmoxFiltrosPayload = {
  codigos?: string[];
  descricoes?: string[];
  coletas?: string[];
};

function filtrosRessupNaoAlmoxToQuery(filtros: RessupNaoAlmoxFiltrosPayload): URLSearchParams {
  const qs = new URLSearchParams();
  const append = (key: string, vals?: string[]) => {
    if (vals?.length) qs.set(key, vals.join('|'));
  };
  append('codigos', filtros.codigos);
  append('descricoes', filtros.descricoes);
  append('coletas', filtros.coletas);
  return qs;
}

export async function buscarOpcoesFiltroRessupNaoAlmox(
  campo: 'codigo' | 'descricao',
  q: string,
  filtros: RessupNaoAlmoxFiltrosPayload
): Promise<{ data: string[]; error?: string }> {
  const qs = filtrosRessupNaoAlmoxToQuery(filtros);
  qs.set('campo', campo);
  qs.set('q', q);
  const res = await apiFetch(`/api/compras/ressup-nao-almox/opcoes-filtro/buscar?${qs.toString()}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: [], error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (j as { data: string[] }).data ?? [] };
}

export async function obterOpcoesFiltroCascataRessupNaoAlmox(
  filtros: RessupNaoAlmoxFiltrosPayload
): Promise<{
  codigos: string[];
  descricoes: string[];
  coletas: string[];
  items: { codigo: string; descricao: string; coleta: string }[];
  error?: string;
}> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/opcoes-filtro/cascata', {
    method: 'POST',
    body: filtros,
  });
  const body = await res.json().catch(() => ({})) as {
    codigos?: string[];
    descricoes?: string[];
    coletas?: string[];
    items?: { codigo: string; descricao: string; coleta: string }[];
    error?: string;
  };
  if (!res.ok) {
    return { codigos: [], descricoes: [], coletas: [], items: [], error: body.error ?? res.statusText };
  }
  return {
    codigos: Array.isArray(body.codigos) ? body.codigos : [],
    descricoes: Array.isArray(body.descricoes) ? body.descricoes : [],
    coletas: Array.isArray(body.coletas) ? body.coletas : [],
    items: Array.isArray(body.items) ? body.items : [],
    error: body.error,
  };
}

export async function obterOpcoesFiltroRessupNaoAlmox(): Promise<{
  codigos: string[];
  descricoes: string[];
  coletas: string[];
  items: { codigo: string; descricao: string; coleta: string }[];
  error?: string;
}> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/opcoes-filtro');
  let body: {
    codigos?: string[];
    descricoes?: string[];
    coletas?: string[];
    items?: { codigo: string; descricao: string; coleta: string }[];
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { codigos: [], descricoes: [], coletas: [], items: [], error: 'Resposta inválida.' };
  }
  if (!res.ok) {
    return {
      codigos: [],
      descricoes: [],
      coletas: [],
      items: [],
      error: body.error ?? `Erro ${res.status}`,
    };
  }
  return {
    codigos: body.codigos ?? [],
    descricoes: body.descricoes ?? [],
    coletas: body.coletas ?? [],
    items: body.items ?? [],
  };
}

export async function fetchRessupNaoAlmoxEstoque(
  idProduto: number,
  codigoPintado?: string | null
): Promise<{ setores: RessupNaoAlmoxEstoqueSetor[]; setoresPintado: RessupNaoAlmoxEstoqueSetor[]; error?: string }> {
  const qs = new URLSearchParams({ idProduto: String(idProduto) });
  if (codigoPintado?.trim()) qs.set('codigoPintado', codigoPintado.trim());
  const res = await apiFetch(`/api/compras/ressup-nao-almox/estoque?${qs}`);
  let body: {
    setores?: RessupNaoAlmoxEstoqueSetor[];
    setoresPintado?: RessupNaoAlmoxEstoqueSetor[];
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { setores: [], setoresPintado: [], error: 'Resposta inválida.' };
  }
  if (!res.ok) return { setores: [], setoresPintado: [], error: body.error ?? `Erro ${res.status}` };
  return { setores: body.setores ?? [], setoresPintado: body.setoresPintado ?? [] };
}

export async function fetchRessupNaoAlmoxCatalogo(): Promise<{
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
}> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/catalogo');
  if (!res.ok) return { descricoes: {}, fundiveis: {} };
  try {
    return (await res.json()) as { descricoes: Record<string, string>; fundiveis: Record<string, string> };
  } catch {
    return { descricoes: {}, fundiveis: {} };
  }
}

export async function saveCatalogoDescricaoNaoAlmox(
  codProduto: string,
  descricao: string
): Promise<{ descricoes: Record<string, string> }> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/catalogo/descricao', {
    method: 'PUT',
    body: { codProduto, descricao },
  });
  if (!res.ok) throw new Error('Falha ao salvar descrição simplificada.');
  return (await res.json()) as { descricoes: Record<string, string> };
}

export async function saveCatalogoFundivelNaoAlmox(
  codSemPintura: string,
  codComPintura: string | null
): Promise<{ fundiveis: Record<string, string> }> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/catalogo/fundivel', {
    method: 'PUT',
    body: { codSemPintura, codComPintura },
  });
  if (!res.ok) throw new Error('Falha ao salvar relação fundível.');
  return (await res.json()) as { fundiveis: Record<string, string> };
}

export async function gravarRessupNaoAlmoxAnalise(params: {
  resumoFiltros?: string;
  payload: RessupNaoAlmoxAnalisePayloadV1;
}): Promise<{ ok?: boolean; id?: number; error?: string }> {
  const res = await apiFetch('/api/compras/ressup-nao-almox/analises', { method: 'POST', body: params });
  let body: { ok?: boolean; id?: number; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { error: 'Resposta inválida.' };
  }
  if (!res.ok) return { error: body.error ?? `Erro ${res.status}` };
  return body;
}

export async function atualizarRessupNaoAlmoxAnalise(
  id: number,
  params: { resumoFiltros?: string; payload: RessupNaoAlmoxAnalisePayloadV1 }
): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiFetch(`/api/compras/ressup-nao-almox/analises/${id}`, { method: 'PUT', body: params });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { error: 'Resposta inválida.' };
  }
  if (!res.ok) return { error: body.error ?? `Erro ${res.status}` };
  return body;
}

export async function processarRessupNaoAlmoxAnalise(id: number): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiFetch(`/api/compras/ressup-nao-almox/analises/${id}/processar`, { method: 'PATCH' });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { error: 'Resposta inválida.' };
  }
  if (!res.ok) return { error: body.error ?? `Erro ${res.status}` };
  return body;
}

export async function concluirRessupNaoAlmoxAnalise(id: number): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiFetch(`/api/compras/ressup-nao-almox/analises/${id}/concluir`, { method: 'PATCH' });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { error: 'Resposta inválida.' };
  }
  if (!res.ok) return { error: body.error ?? `Erro ${res.status}` };
  return body;
}

export async function listarRessupNaoAlmoxAnalises(limit = 80): Promise<{
  data: RessupNaoAlmoxAnaliseListItem[];
  error?: string;
}> {
  const res = await apiFetch(`/api/compras/ressup-nao-almox/analises?limit=${encodeURIComponent(String(limit))}`);
  let body: { data?: RessupNaoAlmoxAnaliseListItem[]; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { data: [], error: 'Resposta inválida.' };
  }
  if (!res.ok) return { data: [], error: body.error ?? `Erro ${res.status}` };
  return { data: body.data ?? [] };
}

export async function obterRessupNaoAlmoxAnalise(id: number): Promise<{
  id: number;
  createdAt: string;
  usuarioLogin: string;
  resumoFiltros: string | null;
  linhaCount: number;
  status: string;
  processadoAt: string | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: string | null;
  usuarioLoginConcluido: string | null;
  payload: RessupNaoAlmoxAnalisePayloadV1 | null;
  error?: string;
}> {
  const res = await apiFetch(`/api/compras/ressup-nao-almox/analises/${id}`);
  let body: {
    id?: number;
    createdAt?: string;
    usuarioLogin?: string;
    resumoFiltros?: string | null;
    linhaCount?: number;
    status?: string;
    processadoAt?: string | null;
    usuarioLoginProcessado?: string | null;
    concluidoAt?: string | null;
    usuarioLoginConcluido?: string | null;
    payload?: RessupNaoAlmoxAnalisePayloadV1 | null;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return {
      id: 0,
      createdAt: '',
      usuarioLogin: '',
      resumoFiltros: null,
      linhaCount: 0,
      status: '',
      processadoAt: null,
      usuarioLoginProcessado: null,
      concluidoAt: null,
      usuarioLoginConcluido: null,
      payload: null,
      error: 'Resposta inválida.',
    };
  }
  if (!res.ok) {
    return {
      id: 0,
      createdAt: '',
      usuarioLogin: '',
      resumoFiltros: null,
      linhaCount: 0,
      status: '',
      processadoAt: null,
      usuarioLoginProcessado: null,
      concluidoAt: null,
      usuarioLoginConcluido: null,
      payload: null,
      error: body.error ?? `Erro ${res.status}`,
    };
  }
  return {
    id: body.id ?? 0,
    createdAt: body.createdAt ?? '',
    usuarioLogin: body.usuarioLogin ?? '',
    resumoFiltros: body.resumoFiltros ?? null,
    linhaCount: body.linhaCount ?? 0,
    status: body.status ?? '',
    processadoAt: body.processadoAt ?? null,
    usuarioLoginProcessado: body.usuarioLoginProcessado ?? null,
    concluidoAt: body.concluidoAt ?? null,
    usuarioLoginConcluido: body.usuarioLoginConcluido ?? null,
    payload: body.payload ?? null,
  };
}
