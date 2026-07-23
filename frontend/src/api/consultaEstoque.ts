import { apiFetch } from './client';

export type ConsultaEstoqueLinha = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  tipoProduto: string;
  saldo: number;
  empenho: number;
  solicitacao: number;
  cotacao: number;
  pedidoCompra: number;
  saldoProjetado: number;
};

export type OpcoesFiltroConsultaEstoque = {
  codigos: string[];
  descricoes: string[];
  tipos: string[];
  grupos: string[];
  coletas: string[];
  setoresProducao: string[];
  subgrupo1: string[];
  subgrupo2: string[];
};

export type ModoPedidoConsultaEstoque = 'diretos' | 'componentes';
export type EmpenhoEscopoConsultaEstoque = 'pedido' | 'todos';
export type FiltroSimNaoTodos = 'todos' | 'sim' | 'nao';

export type FiltrosConsultaEstoquePayload = {
  codigos?: string[];
  descricoes?: string[];
  tipos?: string[];
  grupos?: string[];
  coletas?: string[];
  setoresProducao?: string[];
  subgrupo1?: string[];
  subgrupo2?: string[];
  idPedido?: number;
  modoPedido?: ModoPedidoConsultaEstoque;
  empenhoEscopo?: EmpenhoEscopoConsultaEstoque;
  comEmpenho?: FiltroSimNaoTodos;
  comSaldoEstoque?: FiltroSimNaoTodos;
};

export type PedidoGerenciadorTypeaheadItem = {
  id: number;
  nome: string;
  cliente: string | null;
  dataEmissao: string;
};

export async function obterOpcoesFiltroConsultaEstoque(): Promise<{
  data?: OpcoesFiltroConsultaEstoque;
  error?: string;
}> {
  const res = await apiFetch('/api/pcp/consulta-estoque/opcoes-filtro');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return { error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (await res.json()) as OpcoesFiltroConsultaEstoque };
}

function filtrosToQueryParams(filtros: FiltrosConsultaEstoquePayload): URLSearchParams {
  const qs = new URLSearchParams();
  const append = (key: keyof FiltrosConsultaEstoquePayload, vals?: string[]) => {
    if (vals?.length) qs.set(key, vals.join('|'));
  };
  append('codigos', filtros.codigos);
  append('descricoes', filtros.descricoes);
  append('tipos', filtros.tipos);
  append('grupos', filtros.grupos);
  append('coletas', filtros.coletas);
  append('setoresProducao', filtros.setoresProducao);
  append('subgrupo1', filtros.subgrupo1);
  append('subgrupo2', filtros.subgrupo2);
  return qs;
}

export async function obterOpcoesFiltroCascataConsultaEstoque(
  filtros: FiltrosConsultaEstoquePayload
): Promise<{ data?: OpcoesFiltroConsultaEstoque; error?: string }> {
  const res = await apiFetch('/api/pcp/consulta-estoque/opcoes-filtro/cascata', {
    method: 'POST',
    body: { filtros },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return { error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (await res.json()) as OpcoesFiltroConsultaEstoque };
}

export async function buscarOpcoesFiltroConsultaEstoque(
  campo: 'codigo' | 'descricao',
  q: string,
  filtros: FiltrosConsultaEstoquePayload
): Promise<{ data: string[]; error?: string }> {
  const qs = filtrosToQueryParams(filtros);
  qs.set('campo', campo);
  qs.set('q', q);
  const res = await apiFetch(`/api/pcp/consulta-estoque/opcoes-filtro/buscar?${qs.toString()}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: [], error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (j as { data: string[] }).data ?? [] };
}

export async function buscarPedidosGerenciadorTypeahead(
  q: string
): Promise<{ data: PedidoGerenciadorTypeaheadItem[]; error?: string }> {
  const qs = new URLSearchParams({ q });
  const res = await apiFetch(`/api/pcp/consulta-estoque/opcoes-filtro/pedidos?${qs}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: [], error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (j as { data: PedidoGerenciadorTypeaheadItem[] }).data ?? [] };
}

export async function contarConsultaEstoque(params: {
  filtros: FiltrosConsultaEstoquePayload;
}): Promise<{ total: number; error?: string }> {
  const res = await apiFetch('/api/pcp/consulta-estoque/contar', {
    method: 'POST',
    body: params,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      total: 0,
      error: (j as { error?: string }).error ?? res.statusText,
    };
  }
  return { total: Number((j as { total?: number }).total ?? 0) };
}

export async function consultarEstoque(params: {
  filtros: FiltrosConsultaEstoquePayload;
  considerarRequisicoes: boolean;
}): Promise<{
  data: ConsultaEstoqueLinha[];
  total: number;
  error?: string;
}> {
  const res = await apiFetch('/api/pcp/consulta-estoque/consultar', {
    method: 'POST',
    body: params,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      data: [],
      total: 0,
      error: (j as { error?: string }).error ?? res.statusText,
    };
  }
  return j as {
    data: ConsultaEstoqueLinha[];
    total: number;
  };
}

export type SaldoSetorDetalhe = { idSetor: number; setor: string; saldo: number };
export type ScDetalhe = {
  codigo: number;
  usuario: string;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  saldo: number;
};
export type CotacaoDetalhe = {
  cotacao: string;
  dataEmissao: string | null;
  comprador: string;
  scCodigos: string;
  qtde: number;
};
export type PcPendDetalhe = {
  pedidoCompra: string;
  qtde: number;
  dataEntrega: string | null;
};

async function getDetalhe<T>(path: string, query: Record<string, string>): Promise<{ data: T[]; error?: string }> {
  const qs = new URLSearchParams(query).toString();
  const res = await apiFetch(`/api/pcp/consulta-estoque/detalhe/${path}?${qs}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: [], error: (j as { error?: string }).error ?? res.statusText };
  }
  return { data: (j as { data: T[] }).data ?? [] };
}

export function obterSaldoDetalhe(idProduto: number) {
  return getDetalhe<SaldoSetorDetalhe>('saldo', { idProduto: String(idProduto) });
}

export function obterScDetalhe(idProduto: number) {
  return getDetalhe<ScDetalhe>('solicitacao', { idProduto: String(idProduto) });
}

export function obterCotacaoDetalhe(idProduto: number) {
  return getDetalhe<CotacaoDetalhe>('cotacao', { idProduto: String(idProduto) });
}

export function obterPcDetalhe(idProduto: number) {
  return getDetalhe<PcPendDetalhe>('pedido-compra', { idProduto: String(idProduto) });
}
