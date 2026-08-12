import { apiFetch, apiJson } from './client';

export type LojaKitProdutoSaldo = {
  produtoId: number;
  codigo: string;
  descricao: string;
  saldo: number;
  entradas: number;
  saidas: number;
  estoqueBaixo: boolean;
};

export type LojaKitResumo = {
  produtos: LojaKitProdutoSaldo[];
  totais: {
    entradas: number;
    saidas: number;
    inventarios: number;
    registros: number;
  };
};

export type LojaKitMovimentacao = {
  id: number;
  produtoId: number;
  codigo: string;
  descricao: string;
  tipo: 'entrada' | 'saida' | 'inventario';
  quantidade: number;
  pd: string | null;
  usuarioId: number | null;
  responsavelNome: string;
  observacao: string | null;
  inventarioId: number | null;
  createdAt: string;
};

export type LojaKitInventarioItem = {
  produtoId: number;
  codigo: string;
  descricao: string;
  qtdSistema: number;
  qtdContada: number;
  diferenca: number;
};

export type LojaKitInventario = {
  id: number;
  observacao: string | null;
  usuarioId: number | null;
  responsavelNome: string;
  createdAt: string;
  itens: LojaKitInventarioItem[];
};

export type LojaKitDocumentoSaidaNomus = {
  documentoId: string;
  numero: string;
  dataEmissao: string;
  tipoMovimentacao: string;
  clienteNome: string;
  pedidos: { pedidoId: string; numero: string }[];
};

export type LojaKitItemDocumentoSaidaNomus = {
  codigo: string;
  descricao: string;
  quantidade: number;
  pedidoId: string;
  pedidoNumero: string;
};

async function handleError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) msg = body.error;
  } catch {
    /* ignore */
  }
  throw new Error(msg);
}

export async function fetchLojaEstoqueKitsResumo(): Promise<LojaKitResumo> {
  const r = await apiJson<{ data: LojaKitResumo }>('/api/loja/estoque-kits/resumo');
  return r.data;
}

export async function fetchLojaEstoqueKitsDocumentosSaidaNomus(params?: {
  q?: string;
  limit?: number;
}): Promise<LojaKitDocumentoSaidaNomus[]> {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set('q', params.q.trim());
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const r = await apiJson<{ data: LojaKitDocumentoSaidaNomus[] }>(
    `/api/loja/estoque-kits/documentos-saida${qs ? `?${qs}` : ''}`,
  );
  return r.data;
}

export async function fetchLojaEstoqueKitsItensDocumentoSaidaNomus(
  documentoId: string,
): Promise<LojaKitItemDocumentoSaidaNomus[]> {
  const encoded = encodeURIComponent(documentoId);
  const r = await apiJson<{ data: LojaKitItemDocumentoSaidaNomus[] }>(
    `/api/loja/estoque-kits/documentos-saida/${encoded}/itens`,
  );
  return r.data;
}

export async function fetchLojaEstoqueKitsMovimentacoes(params?: {
  tipo?: 'entrada' | 'saida' | 'inventario';
  produtoId?: number;
  limit?: number;
}): Promise<LojaKitMovimentacao[]> {
  const sp = new URLSearchParams();
  if (params?.tipo) sp.set('tipo', params.tipo);
  if (params?.produtoId != null) sp.set('produtoId', String(params.produtoId));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const r = await apiJson<{ data: LojaKitMovimentacao[] }>(
    `/api/loja/estoque-kits/movimentacoes${qs ? `?${qs}` : ''}`,
  );
  return r.data;
}

export async function postLojaEstoqueKitsMovimentacao(body: {
  produtoId: number;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  pd: string;
  documentoSaida: string;
  produtoPedidoCodigo: string;
  produtoPedidoDescricao?: string | null;
}): Promise<LojaKitMovimentacao> {
  const res = await apiFetch('/api/loja/estoque-kits/movimentacoes', {
    method: 'POST',
    body: body as unknown,
  });
  if (!res.ok) await handleError(res, 'Erro ao registrar movimentação.');
  const json = (await res.json()) as { data: LojaKitMovimentacao };
  return json.data;
}

export async function fetchLojaEstoqueKitsInventarios(): Promise<LojaKitInventario[]> {
  const r = await apiJson<{ data: LojaKitInventario[] }>('/api/loja/estoque-kits/inventarios');
  return r.data;
}

export async function postLojaEstoqueKitsInventario(body: {
  observacao?: string | null;
  itens: { produtoId: number; qtdContada: number }[];
}): Promise<LojaKitInventario> {
  const res = await apiFetch('/api/loja/estoque-kits/inventarios', {
    method: 'POST',
    body: body as unknown,
  });
  if (!res.ok) await handleError(res, 'Erro ao confirmar inventário.');
  const json = (await res.json()) as { data: LojaKitInventario };
  return json.data;
}
