import { apiFetch, getApiBase, getStoredToken } from './client';

export interface PreCompraCotacaoItem {
  cotacao: string;
  data_emissao: string;
  comprador: string;
  email: string;
  telefone: string;
  fornecedor_id: number;
  fornecedor: string;
  cnpj: string;
  telefone_fornecedor: string;
  cep: string;
  endereco: string;
  numero_endereco: string;
  bairro: string;
  municipio: string;
  codigo_produto: string;
  codigo_fornecedor: string;
  descricao_produto: string;
  qtde: number;
  unidade: string;
  preco_unitario: number;
  valor_total: number;
  solicitacao_id: number;
  data_necessidade: string;
  status: number;
  status_label: string;
  cotacao_id?: number;
  /** Números das coletas do Gestão finalizadas vinculadas a esta cotação (direto ou via pedido). */
  numeros_coleta?: number[];
}

export interface PreCompraCotacoesResponse {
  items: PreCompraCotacaoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PreCompraFornecedor {
  id: number;
  nome: string;
  cnpj: string;
}

export interface PreCompraContato {
  id: number;
  nome: string;
}

export interface PreCompraSugestao {
  valor: string;
  subvalor?: string | null;
}

export type CampoSugestaoPreCompra = 'cotacao' | 'fornecedor' | 'comprador' | 'produto';

export interface FiltrosPreCompra {
  cotacao?: string;
  coleta?: string;
  fornecedor?: string;
  produto?: string;
  comprador?: string;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
  page_size?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchPreCompraSugestoes(
  campo: CampoSugestaoPreCompra,
  q: string
): Promise<PreCompraSugestao[]> {
  const params = new URLSearchParams({ campo, q });
  const res = await apiFetch(`/api/compras/pre-compra/sugestoes?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.sugestoes ?? [];
}

export async function fetchPreCompraCotacoes(filtros: FiltrosPreCompra): Promise<PreCompraCotacoesResponse> {
  const res = await apiFetch(
    `/api/compras/pre-compra/cotacoes${buildQuery(filtros as Record<string, string | number | undefined>)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao carregar cotações');
  }
  const data = await res.json();
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? data.page_size ?? 20,
    totalPages: data.totalPages ?? data.total_pages ?? 1,
  };
}

export async function fetchPreCompraFornecedores(cotacao: string): Promise<PreCompraFornecedor[]> {
  const res = await apiFetch(
    `/api/compras/pre-compra/cotacoes/${encodeURIComponent(cotacao)}/fornecedores`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao carregar fornecedores');
  }
  const data = await res.json();
  return data.fornecedores ?? [];
}

export async function fetchPreCompraContatos(
  cotacao: string,
  fornecedorId: number
): Promise<PreCompraContato[]> {
  const res = await apiFetch(
    `/api/compras/pre-compra/cotacoes/${encodeURIComponent(cotacao)}/contatos?fornecedorId=${fornecedorId}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao carregar contatos');
  }
  const data = await res.json();
  return data.contatos ?? [];
}

export async function downloadPreCompraPdf(
  cotacao: string,
  fornecedorId: number,
  contatoId: number
): Promise<void> {
  const base = getApiBase();
  const path = `/api/compras/pre-compra/cotacoes/${encodeURIComponent(cotacao)}/pdf?fornecedorId=${fornecedorId}&contatoId=${contatoId}`;
  const url = base ? `${base}${path}` : path;

  const headers: HeadersInit = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detalhe = typeof err.cause === 'string' && err.cause.trim() ? err.cause.trim() : '';
    throw new Error(detalhe || err.error || 'Erro ao gerar PDF');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `Cotacao_${cotacao}.pdf`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
