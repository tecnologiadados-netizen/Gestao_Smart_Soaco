import { apiFetch } from './client';

export type EtapaAcompanhamento = 'solicitado' | 'comprado' | 'pre_entrada';

export type LinhaAcompanhamento = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  qtdeSolicitado: number;
  qtdeComprado: number;
  qtdePreEntrada: number;
  emissaoSolicitacao: string | null;
  necessidadeSolicitacao: string | null;
  emissaoPedido: string | null;
  emissaoPreEntrada: string | null;
};

export type LinhaDetalheSolicitado = {
  idSolicitacao: number;
  usuario: string | null;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  qtde: number;
};

export type LinhaDetalheComprado = {
  idItem: number;
  solicitacoes: string | null;
  pedido: string;
  fornecedor: string | null;
  dataEntrega: string | null;
  qtde: number;
};

export type LinhaDetalhePreEntrada = {
  idItem: number;
  numeroDocumento: string | null;
  numeroNfe: string | null;
  solicitacoes: string | null;
  fornecedor: string | null;
  dataEmissao: string | null;
  pedidos: string | null;
  qtde: number;
  situacao: 'Pré-entrada';
};

export type DetalheAcompanhamento =
  | { etapa: 'solicitado'; linhas: LinhaDetalheSolicitado[] }
  | { etapa: 'comprado'; linhas: LinhaDetalheComprado[] }
  | { etapa: 'pre_entrada'; linhas: LinhaDetalhePreEntrada[] };

export async function obterPipelineAcompanhamento(): Promise<{
  linhas: LinhaAcompanhamento[];
  error?: string;
}> {
  const res = await apiFetch('/api/pcp/acompanhamento-solicitacao');
  const body = (await res.json().catch(() => ({}))) as { linhas?: LinhaAcompanhamento[]; error?: string };
  if (!res.ok) return { linhas: [], error: body.error ?? res.statusText };
  return { linhas: Array.isArray(body.linhas) ? body.linhas : [] };
}

export async function obterDetalheAcompanhamento(
  idProduto: number,
  etapa: EtapaAcompanhamento
): Promise<{ detalhe: DetalheAcompanhamento | null; error?: string }> {
  const qs = new URLSearchParams({ idProduto: String(idProduto), etapa });
  const res = await apiFetch(`/api/pcp/acompanhamento-solicitacao/detalhe?${qs.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DetalheAcompanhamento & { error?: string };
  if (!res.ok) return { detalhe: null, error: body.error ?? res.statusText };
  if (body.etapa === 'solicitado' || body.etapa === 'comprado' || body.etapa === 'pre_entrada') {
    return { detalhe: { etapa: body.etapa, linhas: body.linhas ?? [] } as DetalheAcompanhamento };
  }
  return { detalhe: null, error: 'Resposta inválida do detalhe.' };
}
